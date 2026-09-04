mod abi;
pub mod invariants;
#[allow(unused)]
mod pb;

use hex_literal::hex;
use pb::contract::v1 as contract;
use std::str::FromStr;
use substreams::prelude::{StoreAdd, StoreNew};
use substreams::scalar::BigInt;
use substreams::store::{DeltaBigInt, Deltas, StoreAddBigInt};
use substreams::Hex;
use substreams_ethereum::pb::eth::v2 as eth;
use substreams_ethereum::Event;

substreams_ethereum::init!();

const TRACKED_VAULTS: [([u8; 20], [u8; 20]); 3] = [
    (
        hex!("beef01735c132ada46aa9aa4c54623caa92a64cb"),
        hex!("a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
    ),
    (
        hex!("38989bba00bdf8181f4082995b3deae96163ac5d"),
        hex!("c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
    ),
    (
        hex!("be53a109b494e5c9f97b9cd39fe969be68bf6204"),
        hex!("a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
    ),
];

fn is_tracked(address: &[u8]) -> bool {
    TRACKED_VAULTS
        .iter()
        .any(|(vault, _)| vault.as_slice() == address)
}

fn is_tracked_asset(address: &[u8]) -> bool {
    TRACKED_VAULTS
        .iter()
        .any(|(_, asset)| asset.as_slice() == address)
}

fn vault_for_asset_transfer(
    asset_address: &[u8],
    from: &[u8],
    to: &[u8],
) -> Option<&'static [u8; 20]> {
    TRACKED_VAULTS.iter().find_map(|(vault, asset)| {
        (asset.as_slice() == asset_address && (vault.as_slice() == from || vault.as_slice() == to))
            .then_some(vault)
    })
}

fn asset_for_vault(address: &[u8]) -> Option<&'static [u8; 20]> {
    TRACKED_VAULTS
        .iter()
        .find_map(|(vault, asset)| (vault.as_slice() == address).then_some(asset))
}

fn is_zero_address(address: &[u8]) -> bool {
    address.len() == 20 && address.iter().all(|byte| *byte == 0)
}

fn address_string(address: &[u8]) -> String {
    let value = Hex(address).to_string();
    if value.starts_with("0x") {
        value
    } else {
        format!("0x{value}")
    }
}

#[substreams::handlers::map]
fn map_events(blk: eth::Block) -> Result<contract::Events, substreams::errors::Error> {
    let mut events = contract::Events::default();

    for receipt in blk.receipts() {
        for log in receipt
            .receipt
            .logs
            .iter()
            .filter(|log| is_tracked(&log.address) || is_tracked_asset(&log.address))
        {
            let Some(event) = abi::erc4626::events::Transfer::match_and_decode(log) else {
                let vault_address = address_string(&log.address);
                let tx_hash = Hex(&receipt.transaction.hash).to_string();
                let block_time = Some(blk.timestamp().to_owned());

                if let Some(event) = abi::erc4626::events::Deposit::match_and_decode(log) {
                    events.deposits.push(contract::Deposit {
                        vault_address,
                        sender: event.sender,
                        owner: event.owner,
                        assets: event.assets.to_string(),
                        shares: event.shares.to_string(),
                        evt_tx_hash: tx_hash,
                        evt_index: log.block_index,
                        evt_block_time: block_time,
                        evt_block_number: blk.number,
                    });
                    continue;
                }

                if let Some(event) = abi::erc4626::events::Withdraw::match_and_decode(log) {
                    events.withdraws.push(contract::Withdraw {
                        vault_address,
                        sender: event.sender,
                        receiver: event.receiver,
                        owner: event.owner,
                        assets: event.assets.to_string(),
                        shares: event.shares.to_string(),
                        evt_tx_hash: tx_hash,
                        evt_index: log.block_index,
                        evt_block_time: block_time,
                        evt_block_number: blk.number,
                    });
                }
                continue;
            };

            let tx_hash = Hex(&receipt.transaction.hash).to_string();
            let block_time = Some(blk.timestamp().to_owned());
            let (vault_address, asset_address, is_asset_transfer) = if let Some(vault) =
                vault_for_asset_transfer(&log.address, &event.from, &event.to)
            {
                (address_string(vault), address_string(&log.address), true)
            } else {
                let Some(asset) = asset_for_vault(&log.address) else {
                    continue;
                };
                (address_string(&log.address), address_string(asset), false)
            };

            events.transfers.push(contract::Transfer {
                vault_address,
                from: event.from,
                to: event.to,
                value: event.value.to_string(),
                evt_tx_hash: tx_hash,
                evt_index: log.block_index,
                evt_block_time: block_time,
                evt_block_number: blk.number,
                asset_address,
                is_asset_transfer,
            });
        }
    }

    Ok(events)
}

#[substreams::handlers::store]
fn store_vault_state(events: contract::Events, output: StoreAddBigInt) {
    // ponytail: ERC-20 balance deltas are the MVP asset proxy; replace with a
    // strategy-aware totalAssets source before calling this production-grade.
    for transfer in events.transfers {
        let (metric, delta) = if transfer.is_asset_transfer {
            let direction = if address_string(&transfer.to) == transfer.vault_address {
                1
            } else if address_string(&transfer.from) == transfer.vault_address {
                -1
            } else {
                continue;
            };
            ("observed_assets", direction)
        } else if is_zero_address(&transfer.from) {
            ("total_supply", 1)
        } else if is_zero_address(&transfer.to) {
            ("total_supply", -1)
        } else {
            continue;
        };

        let amount = BigInt::from_str(&transfer.value).expect("invalid uint256 transfer amount");
        let delta = if delta < 0 { amount.neg() } else { amount };
        let key = format!("vault:{}:{}", transfer.vault_address, metric);
        output.add(transfer.evt_index as u64, key, delta);
    }
}

#[substreams::handlers::map]
fn map_state_changes(
    blk: eth::Block,
    deltas: Deltas<DeltaBigInt>,
) -> Result<contract::StateChanges, substreams::errors::Error> {
    let mut output = contract::StateChanges::default();

    for delta in deltas.into_iter() {
        let mut parts = delta.key.split(':');
        if parts.next() != Some("vault") {
            continue;
        }
        let Some(vault_address) = parts.next() else {
            continue;
        };
        let Some(metric) = parts.next() else {
            continue;
        };

        output.changes.push(contract::StateChange {
            vault_address: vault_address.to_owned(),
            metric: metric.to_owned(),
            previous_value: delta.old_value.to_string(),
            current_value: delta.new_value.to_string(),
            block_number: blk.number,
        });
    }

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_shared_usdc_to_the_vault_in_the_transfer() {
        let steakhouse = hex!("beef01735c132ada46aa9aa4c54623caa92a64cb");
        let yearn = hex!("be53a109b494e5c9f97b9cd39fe969be68bf6204");
        let usdc = hex!("a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");

        assert_eq!(
            vault_for_asset_transfer(&usdc, &[1; 20], &yearn).map(|address| address.as_slice()),
            Some(yearn.as_slice())
        );
        assert_ne!(
            vault_for_asset_transfer(&usdc, &[1; 20], &yearn).map(|address| address.as_slice()),
            Some(steakhouse.as_slice())
        );
    }
}
