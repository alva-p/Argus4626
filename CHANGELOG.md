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
- Se añadieron 5 tests, incluido un caso en el límite de `uint256`.
- Se añadió una prueba explícita para ignorar un baseline vacío (`totalAssets=0`, `totalSupply=0`).
- Se añadió un self-check ejecutable con `cargo run`.
- Se reforzó la aritmética porque `U256 × U256 × basis-points` puede superar 512 bits en el límite teórico.
- Se documentó la arquitectura prevista: Firehose → Substreams → store → Subgraph → dashboard/MCP.
- Se aclaró que una donation requiere observar transferencias del asset o cambios de estado adicionales a los eventos `Deposit` y `Withdraw`.
- Se aclaró que Ethereum y Arbitrum deberán desplegarse como pipelines/subgraphs separados y unificarse desde el frontend.

## Verificación

```bash
cargo test
cargo run
```

Resultado: 5 tests exitosos y self-check del watchdog ejecutado correctamente.
