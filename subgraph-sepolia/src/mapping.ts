import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { ArgusVault, Deposit, Withdraw } from "../generated/DemoVault/ArgusVault";
import { Transfer } from "../generated/DemoAsset/ArgusERC20";
import { Vault, VaultSnapshot, SecurityAlert } from "../generated/schema";

const BPS = BigInt.fromI32(10000);
const INFLATION_THRESHOLD = BigInt.fromI32(10500);
const ZERO_DECIMAL = BigDecimal.fromString("0");

const VAULT_ADDRESS = "0x099cab8f6b806b99cdab9fb120ae8d684f8e6ddd";
const ASSET_ADDRESS = "0x7fecae6e0c360e1695376fe74a7f23993c9842b2";

function pow10(exponent: i32): BigDecimal {
  let result = BigDecimal.fromString("1");
  for (let i = 0; i < exponent; i++) result = result.times(BigDecimal.fromString("10"));
  return result;
}

function getVault(address: Address): Vault {
  let id = address.toHexString();
  let vault = Vault.load(id);
  if (vault != null) return vault as Vault;

  vault = new Vault(id);
  vault.protocol = "Argus Demo";
  vault.name = "Sepolia Inflation Demo";
  vault.symbol = "aDEMO";
  vault.assetAddress = Address.fromString(ASSET_ADDRESS);
  vault.assetSymbol = "aUSDC";
  vault.assetDecimals = 18;
  vault.shareDecimals = 18;
  vault.totalAssets = BigInt.zero();
  vault.totalSupply = BigInt.zero();
  vault.sharePrice = ZERO_DECIMAL;
  vault.lastUpdatedBlock = BigInt.zero();
  vault.save();
  return vault;
}

function refreshVault(vault: Vault, eventId: string, blockNumber: BigInt, timestamp: BigInt, txHash: Bytes): void {
  let previousAssets = vault.totalAssets;
  let previousSupply = vault.totalSupply;
  let assets = previousAssets;
  let supply = previousSupply;

  // ponytail: read the vault's canonical totals on relevant events; add a call cache if RPC cost matters.
  let contract = ArgusVault.bind(Address.fromString(vault.id));
  let totalAssets = contract.try_totalAssets();
  let totalSupply = contract.try_totalSupply();
  if (!totalAssets.reverted) assets = totalAssets.value;
  if (!totalSupply.reverted) supply = totalSupply.value;

  vault.totalAssets = assets;
  vault.totalSupply = supply;
  vault.lastUpdatedBlock = blockNumber;
  if (supply.gt(BigInt.zero())) {
    let normalizedAssets = assets.toBigDecimal();
    let decimalDelta = vault.shareDecimals - vault.assetDecimals;
    if (decimalDelta > 0) normalizedAssets = normalizedAssets.times(pow10(decimalDelta));
    if (decimalDelta < 0) normalizedAssets = normalizedAssets.div(pow10(-decimalDelta));
    vault.sharePrice = normalizedAssets.div(supply.toBigDecimal());
  }
  vault.save();

  let snapshot = new VaultSnapshot(eventId);
  snapshot.vault = vault.id;
  snapshot.blockNumber = blockNumber;
  snapshot.timestamp = timestamp;
  snapshot.totalAssets = assets;
  snapshot.totalSupply = supply;
  snapshot.sharePrice = vault.sharePrice;
  snapshot.save();

  if (
    previousSupply.gt(BigInt.zero()) &&
    previousAssets.gt(BigInt.zero()) &&
    assets.gt(previousAssets) &&
    supply.equals(previousSupply) &&
    assets.times(previousSupply).times(BPS).gt(previousAssets.times(supply).times(INFLATION_THRESHOLD))
  ) {
    let alert = new SecurityAlert(eventId + "-inflation");
    alert.vault = vault.id;
    alert.severity = "CRITICAL";
    alert.alertType = "DONATION_INFLATION_ATTACK_DETECTED";
    alert.description = "Share price increased by more than 5% without a corresponding supply increase.";
    alert.blockNumber = blockNumber;
    alert.timestamp = timestamp;
    alert.transactionHash = txHash;
    alert.save();
  }
}

export function handleDeposit(event: Deposit): void {
  refreshVault(
    getVault(event.address),
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
  );
}

export function handleWithdraw(event: Withdraw): void {
  refreshVault(
    getVault(event.address),
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
  );
}

// Direct asset transfers into the vault (the donation) never emit a Deposit/Withdraw
// event on the vault itself — only a Transfer on the asset contract. Track it so the
// donation tx, not a later unrelated vault call, is the evidence attached to the alert.
export function handleAssetTransfer(event: Transfer): void {
  if (event.params.to.toHexString() != VAULT_ADDRESS) return;

  refreshVault(
    getVault(Address.fromString(VAULT_ADDRESS)),
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
  );
}

export function handleOnce(_block: ethereum.Block): void {
  getVault(Address.fromString(VAULT_ADDRESS));
}
