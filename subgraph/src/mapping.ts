import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { ArgusVault, Deposit, Withdraw } from "../generated/SteakhouseUSDC/ArgusVault";
import { Vault, VaultSnapshot, SecurityAlert } from "../generated/schema";

const BPS = BigInt.fromI32(10000);
const INFLATION_THRESHOLD = BigInt.fromI32(10500);
const ZERO_DECIMAL = BigDecimal.fromString("0");

const STEAKHOUSE = "0xbeef01735c132ada46aa9aa4c54623caa92a64cb";
const FLAGSHIP = "0x38989bba00bdf8181f4082995b3deae96163ac5d";
const YEARN = "0xbe53a109b494e5c9f97b9cd39fe969be68bf6204";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

function pow10(exponent: i32): BigDecimal {
  let result = BigDecimal.fromString("1");
  for (let i = 0; i < exponent; i++) result = result.times(BigDecimal.fromString("10"));
  return result;
}

function metadata(address: Address): string[] {
  let id = address.toHexString();
  if (id == STEAKHOUSE) return ["Morpho", "Steakhouse USDC Vault", "steakUSDC", USDC, "USDC", "6", "18"];
  if (id == FLAGSHIP) return ["Morpho", "Flagship ETH Vault", "flagshipETH", WETH, "WETH", "18", "18"];
  return ["Yearn", "yvUSDC-1", "yvUSDC", USDC, "USDC", "6", "6"];
}

function getVault(address: Address): Vault {
  let id = address.toHexString();
  let vault = Vault.load(id);
  if (vault != null) return vault as Vault;

  let info = metadata(address);
  vault = new Vault(id);
  vault.protocol = info[0];
  vault.name = info[1];
  vault.symbol = info[2];
  vault.assetAddress = Address.fromString(info[3]);
  vault.assetSymbol = info[4];
  vault.assetDecimals = i32(parseInt(info[5]));
  vault.shareDecimals = i32(parseInt(info[6]));
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

export function handleOnce(_block: ethereum.Block): void {
  getVault(Address.fromString(STEAKHOUSE));
  getVault(Address.fromString(FLAGSHIP));
  getVault(Address.fromString(YEARN));
}
