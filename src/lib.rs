mod abi;
pub mod invariants;
#[allow(unused)]
mod pb;

use hex_literal::hex;
use pb::contract::v1 as contract;
use substreams::Hex;
use substreams_ethereum::pb::eth::v2 as eth;
use substreams_ethereum::Event;

substreams_ethereum::init!();

const TRACKED_VAULTS: [[u8; 20]; 3] = [
    hex!("beef01735c132ada46aa9aa4c54623caa92a64cb"),
    hex!("38989bba00bdf8181f4082995b3deae96163ac5d"),
    hex!("be53a109b494e5c9f97b9cd39fe969be68bf6204"),
];

fn is_tracked(address: &[u8]) -> bool {
    TRACKED_VAULTS.iter().any(|vault| vault == address)
}

#[substreams::handlers::map]
fn map_events(blk: eth::Block) -> Result<contract::Events, substreams::errors::Error> {
    let mut events = contract::Events::default();

    for receipt in blk.receipts() {
        for log in receipt
            .receipt
            .logs
            .iter()
            .filter(|log| is_tracked(&log.address))
        {
            let vault_address = Hex(&log.address).to_string();
            let tx_hash = Hex(&receipt.transaction.hash).to_string();
            let block_time = Some(blk.timestamp().to_owned());

            if let Some(event) = abi::erc4626::events::Deposit::match_and_decode(log) {
                events.deposits.push(contract::Deposit {
                    vault_address: vault_address.clone(),
                    sender: event.sender,
                    owner: event.owner,
                    assets: event.assets.to_string(),
                    shares: event.shares.to_string(),
                    evt_tx_hash: tx_hash.clone(),
                    evt_index: log.block_index,
                    evt_block_time: block_time.clone(),
                    evt_block_number: blk.number,
                });
                continue;
            }

            if let Some(event) = abi::erc4626::events::Withdraw::match_and_decode(log) {
                events.withdraws.push(contract::Withdraw {
                    vault_address: vault_address.clone(),
                    sender: event.sender,
                    receiver: event.receiver,
                    owner: event.owner,
                    assets: event.assets.to_string(),
                    shares: event.shares.to_string(),
                    evt_tx_hash: tx_hash.clone(),
                    evt_index: log.block_index,
                    evt_block_time: block_time.clone(),
                    evt_block_number: blk.number,
                });
                continue;
            }

            if let Some(event) = abi::erc4626::events::Transfer::match_and_decode(log) {
                events.transfers.push(contract::Transfer {
                    vault_address,
                    from: event.from,
                    to: event.to,
                    value: event.value.to_string(),
                    evt_tx_hash: tx_hash,
                    evt_index: log.block_index,
                    evt_block_time: block_time,
                    evt_block_number: blk.number,
                });
            }
        }
    }

    Ok(events)
}
