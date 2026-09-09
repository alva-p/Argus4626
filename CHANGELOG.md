# Argus4626 changelog

## 2026-09-04 — Argus brand system

- Added the official Argus4626 logo in horizontal, icon, and favicon variants.
- Replaced the temporary sidebar monogram with the brand lockup.
- Configured the dashboard favicon and kept the cyan/gold-on-obsidian identity.

## 2026-09-04 — Dashboard shell

- Built the `Argus4626 — Vault Intelligence` interface with an operator-console feel.
- Connected the dashboard to the real Subgraph Studio endpoint, refreshing every 15 seconds.
- Added `Vault Observatory`, `Incident Radar`, and the data-lineage panel.
- Kept metrics without a real data source, and unnecessary visual abstractions, out of the first cut.

## 2026-09-04 — Studio-compatible EVM Subgraph

- Replaced the `substreams/graph-entities` adapter, currently rejected by Subgraph Studio.
- Added a standard EVM Subgraph to index ERC-4626 events directly.
- Added the AssemblyScript mapping and reproducible Graph CLI/Graph TS dependencies.
- Kept `graph_out` as the reusable Substreams pipeline output for The Graph Market.
- Updated the README to document the compatible architecture.

Result: codegen and build of the standard Subgraph completed successfully.

## 2026-09-04 — Share price decimal normalization

- Added `shareDecimals` to the `Vault` model.
- Fixed `sharePrice` calculation to support assets and shares with different precisions.
- Validated the `yvUSDC` case, which uses 6 decimals for both the asset and the shares.

## 2026-09-04 — First MVP

- Installed Substreams CLI `v1.22.0` locally.
- Installed the `wasm32-unknown-unknown` Rust target required for Substreams modules.
- Defined the project as a watchdog for ERC-4626-compatible DeFi vaults.
- Renamed the public project from `Delta4626` to `Argus4626`, inspired by Argos Panoptes, the many-eyed giant of Greek mythology associated with vigilance.
- Created the `argus4626` Rust crate.
- Implemented `detect_inflation` to catch a share-price jump without a matching total-supply increase.
- Implemented `detect_liquidity_drain` to catch withdrawals exceeding 35% of available assets in a window.
- Comparisons use `U256` and `U1024`, avoiding floats and overflow even at the theoretical maximum products.
- Added 8 tests, including uint256-boundary cases.
- Added an explicit test to ignore an empty baseline (`totalAssets=0`, `totalSupply=0`).
- Added a runnable self-check via `cargo run`.
- Hardened the arithmetic because `U256 × U256 × basis-points` can exceed 512 bits at the theoretical limit.
- Added the official Substreams scaffold for Ethereum Mainnet.
- Implemented `map_events` in Rust/WASM with a standard decoder for `Deposit`, `Withdraw`, and `Transfer`.
- Configured three real vaults: two MetaMorpho and one Yearn, filtered by a single shared pattern.
- Added the minimal Protobuf schema and the `substreams.yaml` manifest, ready to package.
- Installed `buf` locally and generated the `argus4626-v0.1.0.spkg` package with `substreams build`.
- Documented the intended architecture: Firehose → Substreams → store → Subgraph → dashboard/MCP.
- Noted that detecting a donation requires observing asset transfers or other state changes beyond the `Deposit` and `Withdraw` events.
- Noted that Ethereum and Arbitrum will need separate pipelines/subgraphs, unified from the frontend.

## Verification

```bash
cargo test
cargo run
```

Result: 8 tests passing, watchdog self-check ran successfully, Substreams package generated.

## 2026-09-04 — Per-vault state

- Added `store_vault_state` with per-key accumulation for `observed_assets` and `total_supply`.
- Widened the filter to also observe transfers of the underlying asset, not just vault-emitted events.
- Added `map_state_changes`, exposing previous and current deltas for the next watchdog module.
- Fixed transfer attribution when two vaults share the same USDC asset.
- Kept `observed_assets` as an explicit proxy: it still doesn't represent `totalAssets()` when external strategies are involved.

Result: 9 tests passing, Substreams package generated with `map_events → store_vault_state → map_state_changes`.

## 2026-09-04 — Graph out and minimal Subgraph

- Created a dedicated `feat/graph-out-subgraph` branch for this integration.
- Added the official Graph-Node-compatible protobuf `sf.substreams.sink.entity.v1.EntityChanges`.
- Implemented `graph_out` to emit `Vault` and `VaultSnapshot` entities.
- Added static metadata for the three configured Ethereum vaults.
- Added deterministic decimal `sharePrice` calculation without floats.
- Created `subgraph/schema.graphql` and `subgraph/subgraph.yaml` as a Substreams-powered Subgraph.
- `graph build subgraph/subgraph.yaml` passed with Graph CLI `0.98.1`.
- `substreams run graph_out` processed the real initial block and emitted three `Vault` entities as `EntityChanges`.

Result: 10 tests passing, package compiled, Graph Node output validated against real data.

## 2026-09-04 — SecurityAlert in graph_out

- Created a dedicated `feat/security-alerts-graph` branch.
- Connected `map_events` to `graph_out` to preserve the transaction evidence behind each anomaly.
- Integrated `detect_inflation` into the per-vault state flow.
- Added the immutable `SecurityAlert` entity with severity, type, description, block, timestamp, and transaction.
- Kept detection framed as a donation/inflation anomaly signal, not definitive proof of an exploit.
- Left `LIQUIDITY_DRAIN_EVENT` out until its persistent time window was implemented correctly.

Result: 10 tests passing, valid Graph manifest, `graph_out` run live with the new schema.

## 2026-09-04 — Liquidity rolling window

- Created a dedicated `feat/liquidity-window` branch.
- Added 60-second withdrawal buckets to the per-vault store.
- `graph_out` sums the last 60 buckets for a rolling window of roughly 60 minutes.
- Connected `LIQUIDITY_DRAIN_EVENT` to `SecurityAlert` with `WARNING` severity and transaction evidence.
- Documented the one-minute granularity as an explicit MVP decision.

Result: 10 tests passing, package compiled, valid Graph manifest, live run completed.

## 2026-09-08 — Sepolia case: real donation/inflation attack

- Reproduced the first-depositor donation/inflation attack on Sepolia against a plain OpenZeppelin `ERC4626` vault: a real deposit followed by a real direct-transfer donation, confirmed `CRITICAL` by `detect_inflation`.
- Added a second Subgraph Studio deployment (`subgraph-sepolia/`) with an extra `dataSource` on the underlying asset's `Transfer` event — required because a donation never touches the vault's own events.
- Extracted the vault detail JSX into a shared `VaultDetailView` component and added a dedicated `/vault/sepolia-demo` route pointing at the Sepolia endpoint.

## 2026-09-09 — Two more invariants

- Added `detect_share_price_crash` (assets drop sharply while supply holds — loss of funds, exploit, bad debt) and `detect_unbacked_mint` (supply grows while assets hold — shares minted without matching backing).
- Both reuse the same overflow-safe `U1024` comparison as `detect_inflation`, wired into `graph_out` and the frontend alert copy.
