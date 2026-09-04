# Contexto de Argus4626

Documento para que otro agente pueda revisar el estado del proyecto sin depender del historial de conversación.

## Objetivo

Argus4626 es un watchdog para bóvedas DeFi compatibles con ERC-4626. El nombre está inspirado en Argos Panoptes, personaje de la mitología griega asociado con la vigilancia.

La idea para ETHOnline 2026 es crear una infraestructura reutilizable que:

1. Lea datos on-chain de bóvedas ERC-4626.
2. Normalice protocolos diferentes como Morpho, Yearn y Beefy.
3. Calcule invariantes de seguridad.
4. Exponga snapshots y alertas mediante The Graph.
5. Muestre los resultados en un dashboard visual y, opcionalmente, mediante un agente/MCP.

## Estado inicial del repositorio

El repositorio estaba prácticamente vacío: solo tenía un `README.md` con el título `Argus4626`.

Todavía no existían Substreams, Subgraph, frontend ni MCP.

## Cambios realizados

### Rust

- Se creó el crate `argus4626` en `Cargo.toml`.
- Se añadieron `primitive-types` y `uint` para representar valores `U256` y un acumulador `U1024` de cálculo.
- Se creó `src/lib.rs` y el módulo `src/invariants.rs`.
- Se creó `src/main.rs` como self-check ejecutable.

### Invariante de inflation/donation

La función `detect_inflation(previous, current)` genera una alerta crítica cuando:

- existe un snapshot previo válido;
- `totalAssets` aumentó;
- `totalSupply` no cambió;
- el precio implícito por share aumentó más de 5%.

La comparación evita divisiones y floats:

```text
currentAssets * previousSupply * 10000
>
previousAssets * currentSupply * 10500
```

Esto representa:

```text
currentSharePrice / previousSharePrice > 1.05
```

### Invariante de liquidez

La función `detect_liquidity_drain(withdrawn, available)` genera una alerta warning cuando:

- hubo retiros;
- los retiros superan el 35% de la suma entre activos disponibles y retiros.

La comparación es:

```text
withdrawn * 10000
>
(available + withdrawn) * 3500
```

La suma y los productos se hacen en `U1024` para evitar overflow antes de comparar valores `U256`. `U512` no alcanza para el peor caso `U256 × U256 × 10000`.

### Tests

Actualmente hay 8 tests:

- Detecta salto de precio sin cambio de supply.
- Ignora un depósito normal donde assets y supply aumentan juntos.
- Ignora un snapshot inicial vacío porque todavía no existe un precio por share comparable.
- Detecta drenaje superior al 35%.
- Funciona con valores grandes de escala `uint256`.
- No desborda en el límite de `uint256`.
- No desborda cuando los productos de inflación alcanzan el límite de `uint256`.
- No desborda cuando assets y retiros son `uint256::MAX`.

## Validación actual

Estos comandos deben funcionar desde la raíz del repositorio:

```bash
cargo fmt --check
cargo test
cargo run
```

Resultado esperado:

```text
5 tests passed
Argus4626 ok: donation/inflation invariant detected
```

También está preparado el entorno local para Substreams:

- Substreams CLI `v1.22.0` instalado en `/home/alvap/.local/bin/substreams`.
- Target Rust `wasm32-unknown-unknown` instalado.
- Todavía falta autenticar un proveedor y generar el proyecto Substreams.

## Arquitectura prevista, aún no implementada

```text
Firehose block
  -> map_events: Deposit, Withdraw y ERC-20 Transfer
  -> store_vault_state: estado por bóveda entre bloques
  -> graph_out: snapshots y alertas para entidades Graph
  -> Substreams-powered Subgraph
  -> dashboard web
  -> MCP/agente opcional
```

## Decisiones y advertencias importantes

1. Un módulo `map` de Substreams es stateless. El estado entre bloques debe modelarse con un módulo `store` y un módulo posterior.
2. `Deposit` y `Withdraw` no bastan para detectar una donation directa. Hay que observar transferencias del token asset hacia la bóveda, cambios de balance u otra fuente confiable de `totalAssets()`.
3. Una sola bóveda puede tener activos en estrategias externas; el balance ERC-20 directo no siempre equivale a `totalAssets()`.
4. Ethereum y Arbitrum deben tratarse como despliegues/pipelines separados y unificarse en el frontend.
5. La alerta actual solo contiene tipo y severidad. El pipeline real deberá agregar dirección de bóveda, bloque, timestamp, transacción, métrica y descripción.
6. El dashboard visual todavía no existe. Debe ser la interfaz principal de la demo; el MCP sería una capa adicional para consultas de agentes.
7. Las alertas deben presentarse como anomalías sospechosas, no como prueba definitiva de un exploit.

## Próximo paso recomendado

Implementar el pipeline real mínimo para una sola red:

1. Instalar/verificar Substreams CLI.
2. Crear el módulo `map_events` para filtrar las bóvedas seleccionadas.
3. Crear el estado por bóveda.
4. Emitir snapshots y alertas compatibles con un Substreams-powered Subgraph.
5. Crear un dashboard mínimo con tabla de salud, radar de incidentes y detalle de una bóveda.
6. Probar una donation en una bóveda ERC-4626 de Sepolia para producir una alerta real en la demo.

## Pedido de revisión para otro agente

Revisar este repositorio y responder:

1. ¿Las fórmulas de `src/invariants.rs` son correctas en sus límites?
2. ¿Hay overflow, división implícita incorrecta o falsos positivos obvios?
3. ¿Qué necesita cambiar para conectar correctamente el crate a Substreams?
4. ¿Cuál es el mínimo `map -> store -> graph_out` que puede desplegarse con datos vivos?
5. ¿Qué partes del alcance deben descartarse para llegar a una demo funcional?

No agregar frontend, MCP, nuevos protocolos ni deployment hasta validar ese camino mínimo.
