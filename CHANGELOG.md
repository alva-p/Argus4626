# Cambios de Argus4626

## 2026-09-04 — Primer MVP

- Se instaló Substreams CLI `v1.22.0` en `/home/alvap/.local/bin`.
- Se instaló el target Rust `wasm32-unknown-unknown` requerido para módulos Substreams.
- Se definió el proyecto como un watchdog para bóvedas DeFi compatibles con ERC-4626.
- Se cambió el nombre público de `Delta4626` a `Argus4626`, inspirado en Argos Panoptes, el gigante de la mitología griega asociado con la vigilancia.
- Se creó el crate Rust `argus4626`.
- Se implementó `detect_inflation` para detectar un salto del precio por share sin aumento del total supply.
- Se implementó `detect_liquidity_drain` para detectar retiros que superen el 35% de los activos disponibles en una ventana.
- Las comparaciones usan `U256` y `U1024`, evitando floats y desbordamientos incluso en los productos teóricos máximos.
- Se añadieron 8 tests, incluidos casos en el límite de `uint256`.
- Se añadió una prueba explícita para ignorar un baseline vacío (`totalAssets=0`, `totalSupply=0`).
- Se añadió un self-check ejecutable con `cargo run`.
- Se reforzó la aritmética porque `U256 × U256 × basis-points` puede superar 512 bits en el límite teórico.
- Se añadió el scaffold oficial de Substreams para Ethereum Mainnet.
- Se implementó `map_events` en Rust/WASM con un decoder estándar para `Deposit`, `Withdraw` y `Transfer`.
- Se configuraron tres bóvedas reales: dos MetaMorpho y una Yearn, filtradas por un único patrón.
- Se añadió el esquema Protobuf mínimo y el manifiesto `substreams.yaml` listo para empaquetar.
- Se instaló `buf` localmente y se generó el paquete `argus4626-v0.1.0.spkg` con `substreams build`.
- Se documentó la arquitectura prevista: Firehose → Substreams → store → Subgraph → dashboard/MCP.
- Se aclaró que una donation requiere observar transferencias del asset o cambios de estado adicionales a los eventos `Deposit` y `Withdraw`.
- Se aclaró que Ethereum y Arbitrum deberán desplegarse como pipelines/subgraphs separados y unificarse desde el frontend.

## Verificación

```bash
cargo test
cargo run
```

Resultado: 8 tests exitosos, self-check del watchdog ejecutado correctamente y paquete Substreams generado.

## 2026-09-04 — Estado por bóveda

- Se añadió `store_vault_state` con acumulación por clave para `observed_assets` y `total_supply`.
- Se amplió el filtro para observar transferencias del activo subyacente además de eventos emitidos por la bóveda.
- Se añadió `map_state_changes`, que expone los deltas anteriores y actuales para el siguiente módulo de watchdog.
- Se corrigió la atribución de transferencias cuando dos bóvedas comparten el mismo activo USDC.
- Se mantuvo `observed_assets` como proxy explícito: todavía no representa `totalAssets()` cuando existen estrategias externas.

Resultado: 9 tests exitosos y paquete Substreams generado con `map_events → store_vault_state → map_state_changes`.

## 2026-09-04 — Graph out y Subgraph mínimo

- Se creó la rama dedicada `feat/graph-out-subgraph` para esta integración.
- Se añadió el protobuf oficial compatible con Graph Node `sf.substreams.sink.entity.v1.EntityChanges`.
- Se implementó `graph_out` para emitir entidades `Vault` y `VaultSnapshot`.
- Se añadieron metadatos estáticos de las tres bóvedas Ethereum configuradas.
- Se añadió cálculo decimal determinista del `sharePrice` sin floats.
- Se creó `subgraph/schema.graphql` y `subgraph/subgraph.yaml` como Substreams-powered Subgraph.
- `graph build subgraph/subgraph.yaml` pasó correctamente con Graph CLI `0.98.1`.
- `substreams run graph_out` procesó el bloque inicial real y emitió tres entidades `Vault` en formato `EntityChanges`.

Resultado: 10 tests exitosos, paquete compilado y salida Graph Node validada sobre datos reales.

## 2026-09-04 — SecurityAlert en graph_out

- Se creó la rama dedicada `feat/security-alerts-graph`.
- Se conectó `map_events` a `graph_out` para conservar la evidencia de la transacción que origina una anomalía.
- Se integró `detect_inflation` al flujo de estado por bóveda.
- Se añadió la entidad inmutable `SecurityAlert` con severidad, tipo, descripción, bloque, timestamp y transacción.
- Se mantiene la detección como señal de anomalía donation/inflation, no como prueba definitiva de exploit.
- Se dejó fuera `LIQUIDITY_DRAIN_EVENT` hasta implementar correctamente su ventana temporal persistente.

Resultado: 10 tests exitosos, manifest Graph válido y `graph_out` ejecutado live con el nuevo schema.

## 2026-09-04 — Ventana móvil de liquidez

- Se creó la rama dedicada `feat/liquidity-window`.
- Se añadieron buckets de retiros de 60 segundos al store por bóveda.
- `graph_out` suma los últimos 60 buckets para una ventana móvil de aproximadamente 60 minutos.
- Se conectó `LIQUIDITY_DRAIN_EVENT` a `SecurityAlert` con severidad `WARNING` y evidencia de la transacción.
- La granularidad de un minuto queda documentada como una decisión explícita del MVP.

Resultado: 10 tests exitosos, paquete compilado, manifest Graph válido y ejecución live completada.
