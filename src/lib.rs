mod abi;
mod entity_changes;
pub mod invariants;
#[allow(unused)]
mod pb;

use hex_literal::hex;
use pb::contract::v1 as contract;
use pb::sf::substreams::sink::entity::v1::{EntityChanges, Operation};
use std::str::FromStr;
use substreams::prelude::{StoreAdd, StoreNew};
use substreams::scalar::BigInt;
use substreams::store::{DeltaBigInt, Deltas, StoreAddBigInt, StoreGet, StoreGetBigInt};
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

const INITIAL_BLOCK: u64 = 18_941_135;

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

fn vault_metadata(
    address: &[u8],
) -> Option<(&'static str, &'static str, &'static str, &'static str, i32)> {
    if address == TRACKED_VAULTS[0].0.as_slice() {
        Some(("Morpho", "Steakhouse USDC", "steakhouseUSDC", "USDC", 6))
    } else if address == TRACKED_VAULTS[1].0.as_slice() {
        Some(("Morpho", "Flagship ETH", "flagshipETH", "WETH", 18))
    } else if address == TRACKED_VAULTS[2].0.as_slice() {
        Some(("Yearn", "yvUSDC", "yvUSDC", "USDC", 6))
    } else {
        None
    }
}

fn share_price(assets: &str, supply: &str) -> String {
    let Ok(assets) = assets.parse::<num_bigint::BigUint>() else {
        return "0".to_owned();
    };
    let Ok(supply) = supply.parse::<num_bigint::BigUint>() else {
        return "0".to_owned();
    };
    if supply == num_bigint::BigUint::from(0u8) {
        return "0".to_owned();
    }

    let scale = num_bigint::BigUint::from(10u8).pow(18);
    let scaled = assets * &scale / supply;
    let whole = &scaled / &scale;
    let fraction = (&scaled % &scale).to_str_radix(10);
    format!("{whole}.{:0>18}", fraction)
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

#[substreams::handlers::map]
fn graph_out(
    blk: eth::Block,
    store: StoreGetBigInt,
    deltas: Deltas<DeltaBigInt>,
) -> Result<EntityChanges, substreams::errors::Error> {
    let mut changes = Vec::new();

    if blk.number == INITIAL_BLOCK {
        for (vault, asset) in TRACKED_VAULTS {
            let Some((protocol, name, symbol, asset_symbol, asset_decimals)) =
                vault_metadata(&vault)
            else {
                continue;
            };
            let id = address_string(&vault);
            let zero = "0".to_owned();
            changes.push(entity_changes::change(
                "Vault",
                &id,
                Operation::Create,
                vec![
                    entity_changes::field("id", entity_changes::string(id.clone())),
                    entity_changes::field("protocol", entity_changes::string(protocol)),
                    entity_changes::field("name", entity_changes::string(name)),
                    entity_changes::field("symbol", entity_changes::string(symbol)),
                    entity_changes::field("assetAddress", entity_changes::bytes(&asset)),
                    entity_changes::field("assetSymbol", entity_changes::string(asset_symbol)),
                    entity_changes::field("assetDecimals", entity_changes::int32(asset_decimals)),
                    entity_changes::field("totalAssets", entity_changes::bigint(&zero)),
                    entity_changes::field("totalSupply", entity_changes::bigint(&zero)),
                    entity_changes::field("sharePrice", entity_changes::bigdecimal(&zero)),
                    entity_changes::field(
                        "lastUpdatedBlock",
                        entity_changes::bigint(INITIAL_BLOCK.to_string()),
                    ),
                ],
            ));
        }
    }

    let mut states = std::collections::BTreeMap::new();
    for delta in deltas.into_iter() {
        let mut parts = delta.key.split(':');
        if parts.next() != Some("vault") {
            continue;
        }
        let Some(vault) = parts.next() else { continue };
        let Some(metric) = parts.next() else { continue };
        if metric != "observed_assets" && metric != "total_supply" {
            continue;
        }

        let assets_key = format!("vault:{vault}:observed_assets");
        let supply_key = format!("vault:{vault}:total_supply");
        let (assets, supply): (String, String) = if metric == "observed_assets" {
            (
                delta.new_value.to_string(),
                store
                    .get_at(delta.ordinal, &supply_key)
                    .unwrap_or_else(|| BigInt::from(0))
                    .to_string(),
            )
        } else {
            (
                store
                    .get_at(delta.ordinal, &assets_key)
                    .unwrap_or_else(|| BigInt::from(0))
                    .to_string(),
                delta.new_value.to_string(),
            )
        };

        let price = share_price(&assets, &supply);
        states.insert(vault.to_owned(), (assets, supply, price));
    }

    for (vault, (assets, supply, price)) in states {
        changes.push(entity_changes::change(
            "Vault",
            &vault,
            Operation::Update,
            vec![
                entity_changes::field("totalAssets", entity_changes::bigint(&assets)),
                entity_changes::field("totalSupply", entity_changes::bigint(&supply)),
                entity_changes::field("sharePrice", entity_changes::bigdecimal(&price)),
                entity_changes::field(
                    "lastUpdatedBlock",
                    entity_changes::bigint(blk.number.to_string()),
                ),
            ],
        ));

        let snapshot_id = format!("{vault}-{}", blk.number);
        changes.push(entity_changes::change(
            "VaultSnapshot",
            &snapshot_id,
            Operation::Create,
            vec![
                entity_changes::field("id", entity_changes::string(&snapshot_id)),
                entity_changes::field("vault", entity_changes::string(&vault)),
                entity_changes::field(
                    "blockNumber",
                    entity_changes::bigint(blk.number.to_string()),
                ),
                entity_changes::field(
                    "timestamp",
                    entity_changes::bigint(blk.timestamp().seconds.to_string()),
                ),
                entity_changes::field("totalAssets", entity_changes::bigint(&assets)),
                entity_changes::field("totalSupply", entity_changes::bigint(&supply)),
                entity_changes::field("sharePrice", entity_changes::bigdecimal(&price)),
            ],
        ));
    }

    Ok(entity_changes::output(changes))
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

    #[test]
    fn formats_share_price_without_float_rounding() {
        assert_eq!(share_price("1000001", "1000000"), "1.000001000000000000");
        assert_eq!(share_price("100", "0"), "0");
    }
}
