# Argus4626

Argus4626 es un watchdog ERC-4626 para ETHOnline 2026. El nombre refiere a Argos Panoptes, el gigante de la mitología griega con cien ojos: una metáfora para observar muchas bóvedas al mismo tiempo.

## Qué funciona hoy

El crate implementa las dos reglas de seguridad que necesitamos demostrar:

- `DONATION_INFLATION_ATTACK_DETECTED`: el precio de share supera el umbral configurado sin cambiar el supply.
- `LIQUIDITY_DRAIN_EVENT`: los retiros de una ventana superan el porcentaje configurado de los activos disponibles.

La comparación se hace con enteros de 512 bits para no perder precisión al multiplicar valores `uint256`.

```bash
cargo test
cargo run
```

## Modelo para la hackathon

```text
Firehose block
  -> map_events (logs ERC-4626 + ERC-20 Transfer)
  -> store_vault_state (estado por vault entre bloques)
  -> graph_out (EntityChanges)
  -> Substreams-powered Subgraph
  -> dashboard
```

El primer despliegue debe ser Ethereum mainnet. Arbitrum se agrega como un segundo paquete/subgraph y el frontend unifica ambos endpoints: un Substreams-powered Subgraph tiene una sola datasource y una red por despliegue.

## Decisiones importantes

1. `Deposit` y `Withdraw` sirven para flujos, pero no detectan una donation por sí solos. Para eso el extractor también debe observar `Transfer(asset, _, vault)` y `Transfer(asset, vault, _)`, o leer `totalAssets()` en el contrato.
2. El estado bloque a bloque no vive en un `map` puro; en Substreams se modela con un módulo `store` y un módulo posterior que emite snapshots/alertas.
3. El umbral de inflación queda expresado en basis points (`500 = 5%`) para que la alerta no dependa de `float`.

## Siguiente corte

Con el núcleo validado, instalamos Substreams CLI, generamos el proyecto con `substreams codegen subgraph` y conectamos primero las bóvedas Ethereum de Morpho/Yearn. El dashboard se agrega después de tener una query GraphQL real.
