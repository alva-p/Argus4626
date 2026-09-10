import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { ArgusVault, Deposit, Withdraw, Transfer as ShareTransfer } from "../generated/DemoVault/ArgusVault";
import { Transfer as AssetTransfer } from "../generated/DemoAsset/ArgusERC20";
import { Vault, VaultSnapshot, SecurityAlert } from "../generated/schema";

const BPS = BigInt.fromI32(10000);
const INFLATION_THRESHOLD = BigInt.fromI32(10500);
const CRASH_THRESHOLD = BigInt.fromI32(10500);
const UNBACKED_MINT_THRESHOLD = BigInt.fromI32(10500);
const LIQUIDITY_DRAIN_THRESHOLD = BigInt.fromI32(3500);
const ZERO_DECIMAL = BigDecimal.fromString("0");

const ASSET_ADDRESS = "0x7fecae6e0c360e1695376fe74a7f23993c9842b2";
const DONATION_VAULT = "0x099cab8f6b806b99cdab9fb120ae8d684f8e6ddd";
const LIQUIDITY_VAULT = "0x18c5a7ab3602680dd18fb5f074c3662f473c93f1";
const SIM_VAULT = "0x90bba5d49163dbf3f20c4f4d562307e03bb34ab0";

function isTrackedVault(address: string): bool {
  return address == DONATION_VAULT || address == LIQUIDITY_VAULT || address == SIM_VAULT;
}

function vaultName(address: string): string {
  if (address == LIQUIDITY_VAULT) return "Sepolia Liquidity Drain Demo";
  if (address == SIM_VAULT) return "Sepolia Crash / Unbacked Mint Demo";
  return "Sepolia Inflation Demo";
}

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
  vault.name = vaultName(id);
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

// Reads the vault's canonical totals and records a snapshot; returns the
// previous totals so callers can run their own pairwise invariant checks
// (liquidity drain needs the withdrawn amount too, which isn't visible here).
function refreshVault(vault: Vault, eventId: string, blockNumber: BigInt, timestamp: BigInt): VaultState {
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

  return new VaultState(previousAssets, previousSupply, assets, supply);
}

class VaultState {
  constructor(
    public previousAssets: BigInt,
    public previousSupply: BigInt,
    public assets: BigInt,
    public supply: BigInt,
  ) {}
}

function saveAlert(vault: Vault, eventId: string, severity: string, alertType: string, description: string, blockNumber: BigInt, timestamp: BigInt, txHash: Bytes): void {
  let alert = new SecurityAlert(eventId + "-" + alertType);
  alert.vault = vault.id;
  alert.severity = severity;
  alert.alertType = alertType;
  alert.description = description;
  alert.blockNumber = blockNumber;
  alert.timestamp = timestamp;
  alert.transactionHash = txHash;
  alert.save();
}

// Mirrors src/invariants.rs's detect_inflation / detect_share_price_crash /
// detect_unbacked_mint: all three are the same price-ratio comparison, just
// gated on which side (assets vs supply) held still and which direction moved.
function checkPairwiseInvariants(vault: Vault, state: VaultState, eventId: string, blockNumber: BigInt, timestamp: BigInt, txHash: Bytes): void {
  if (state.previousAssets.equals(BigInt.zero()) || state.previousSupply.equals(BigInt.zero())) return;

  if (
    state.supply.equals(state.previousSupply) &&
    state.assets.gt(state.previousAssets) &&
    state.assets.times(state.previousSupply).times(BPS).gt(state.previousAssets.times(state.supply).times(INFLATION_THRESHOLD))
  ) {
    saveAlert(vault, eventId, "CRITICAL", "DONATION_INFLATION_ATTACK_DETECTED", "Share price increased by more than 5% without a corresponding supply increase.", blockNumber, timestamp, txHash);
  }

  if (
    state.supply.equals(state.previousSupply) &&
    state.assets.lt(state.previousAssets) &&
    state.previousAssets.times(state.supply).times(BPS).gt(state.assets.times(state.previousSupply).times(CRASH_THRESHOLD))
  ) {
    saveAlert(vault, eventId, "CRITICAL", "SHARE_PRICE_CRASH_DETECTED", "Share price dropped by more than 5% while total supply stayed unchanged.", blockNumber, timestamp, txHash);
  }

  if (
    state.assets.equals(state.previousAssets) &&
    state.supply.gt(state.previousSupply) &&
    state.previousAssets.times(state.supply).times(BPS).gt(state.assets.times(state.previousSupply).times(UNBACKED_MINT_THRESHOLD))
  ) {
    saveAlert(vault, eventId, "CRITICAL", "UNBACKED_MINT_DETECTED", "Share supply grew enough to move the price more than 5% while total assets stayed unchanged.", blockNumber, timestamp, txHash);
  }
}

export function handleDeposit(event: Deposit): void {
  let vault = getVault(event.address);
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let state = refreshVault(vault, eventId, event.block.number, event.block.timestamp);
  checkPairwiseInvariants(vault, state, eventId, event.block.number, event.block.timestamp, event.transaction.hash);
}

export function handleWithdraw(event: Withdraw): void {
  let vault = getVault(event.address);
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let state = refreshVault(vault, eventId, event.block.number, event.block.timestamp);
  checkPairwiseInvariants(vault, state, eventId, event.block.number, event.block.timestamp, event.transaction.hash);

  // Liquidity drain needs the withdrawn amount itself, not just the before/after totals.
  let withdrawn = event.params.assets;
  let available = state.assets;
  if (withdrawn.gt(BigInt.zero()) && withdrawn.times(BPS).gt(available.plus(withdrawn).times(LIQUIDITY_DRAIN_THRESHOLD))) {
    saveAlert(vault, eventId, "WARNING", "LIQUIDITY_DRAIN_EVENT", "Withdrawal exceeded 35% of available liquidity.", event.block.number, event.block.timestamp, event.transaction.hash);
  }
}

// A vault's own shares are an ERC-20: simulateUnbackedMint mints shares
// straight to an address with no Deposit event at all, so it only shows up
// here as a bare Transfer from the zero address.
export function handleShareTransfer(event: ShareTransfer): void {
  if (!event.params.from.equals(Address.zero())) return;

  let vault = getVault(event.address);
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let state = refreshVault(vault, eventId, event.block.number, event.block.timestamp);
  checkPairwiseInvariants(vault, state, eventId, event.block.number, event.block.timestamp, event.transaction.hash);
}

// Direct asset transfers into or out of a vault (donation, or simulateLoss's
// payout) never emit a Deposit/Withdraw event on the vault itself — only a
// Transfer on the asset contract. Track both directions so the actual
// donation/loss tx, not a later unrelated vault call, is the alert's evidence.
export function handleAssetTransfer(event: AssetTransfer): void {
  let to = event.params.to.toHexString();
  let from = event.params.from.toHexString();
  let target = "";
  if (isTrackedVault(to)) target = to;
  else if (isTrackedVault(from)) target = from;
  else return;

  let vault = getVault(Address.fromString(target));
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let state = refreshVault(vault, eventId, event.block.number, event.block.timestamp);
  checkPairwiseInvariants(vault, state, eventId, event.block.number, event.block.timestamp, event.transaction.hash);
}

export function handleOnce(_block: ethereum.Block): void {
  getVault(Address.fromString(DONATION_VAULT));
  getVault(Address.fromString(LIQUIDITY_VAULT));
  getVault(Address.fromString(SIM_VAULT));
}
