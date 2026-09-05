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

Inicialmente no existían Substreams, Subgraph, frontend ni MCP. El módulo real de Substreams y el adaptador estándar de Subgraph ya están implementados; frontend y MCP siguen pendientes.

## Cambios realizados

### Rust

- Se creó el crate `argus4626` en `Cargo.toml`.
- Se añadieron `primitive-types` y `uint` para representar valores `U256` y un acumulador `U1024` de cálculo.
- Se creó `src/lib.rs` y el módulo `src/invariants.rs`.
- Se creó `src/main.rs` como self-check ejecutable.
- Se añadió el scaffold compatible con `substreams build`: `build.rs`, `buf.gen.yaml`, `proto/`, `src/abi/`, `src/pb/` y `substreams.yaml`.
- Se implementó `map_events` para decodificar `Deposit`, `Withdraw` y `Transfer` sobre tres direcciones reales de Ethereum Mainnet con un único patrón ERC-4626.
- Se añadió `store_vault_state`, que acumula por bóveda los deltas de `observed_assets` y `total_supply`.
- Se añadió `map_state_changes`, que convierte los deltas del store en una salida Protobuf para diagnóstico.
- Se añadió `graph_out`, que emite `EntityChanges` compatibles con Graph Node para `Vault`, `VaultSnapshot` y `SecurityAlert`.
- Se creó un Subgraph EVM estándar en `subgraph/` para desplegarlo en Subgraph Studio.
- Se añadió el mapping AssemblyScript y las dependencias de Graph CLI/Graph TS para indexar los eventos ERC-4626 directamente.
- Se añadieron buckets de retiros de 60 segundos y una ventana móvil de 60 buckets para `LIQUIDITY_DRAIN_EVENT`.

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

Actualmente hay 10 tests:

- Detecta salto de precio sin cambio de supply.
- Ignora un depósito normal donde assets y supply aumentan juntos.
- Ignora un snapshot inicial vacío porque todavía no existe un precio por share comparable.
- Detecta drenaje superior al 35%.
- Funciona con valores grandes de escala `uint256`.
- No desborda en el límite de `uint256`.
- No desborda cuando los productos de inflación alcanzan el límite de `uint256`.
- No desborda cuando assets y retiros son `uint256::MAX`.
- No mezcla dos bóvedas que comparten el activo USDC.
- Calcula `sharePrice` decimal sin floats ni redondeo binario.

## Validación actual

Estos comandos deben funcionar desde la raíz del repositorio:

```bash
cargo fmt --check
cargo test
cargo run
```

Resultado esperado:

```text
10 tests passed
Argus4626 ok: donation/inflation invariant detected
```

También está preparado el entorno local para Substreams:

- Substreams CLI `v1.22.0` instalado en `/home/alvap/.local/bin/substreams`.
- Target Rust `wasm32-unknown-unknown` instalado.
- `buf` `v1.72.0` instalado en `/home/alvap/.local/bin/buf` para generar Protobuf.
- `substreams build` genera correctamente un paquete `.spkg` desde el manifiesto.

## Arquitectura actual y siguiente etapa

```text
Firehose block
  -> map_events: Deposit, Withdraw y ERC-20 Transfer [implementado]
  -> store_vault_state: observed_assets, total_supply y withdrawal buckets [implementado]
  -> map_state_changes: deltas normalizados [implementado]
  -> graph_out: Vault, VaultSnapshot y SecurityAlert como EntityChanges [implementado]
  -> The Graph Market: consumo del paquete Substreams [validado en vivo]
  -> Standard EVM Subgraph: eventos ERC-4626 para Subgraph Studio [implementado]
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
8. Studio no acepta el adaptador `substreams/graph-entities` usado originalmente. `graph_out` se conserva como salida reutilizable de Substreams y Studio recibe un Subgraph EVM estándar.

## Próximo paso recomendado

Implementar el pipeline real mínimo para una sola red:

1. Reemplazar o complementar `observed_assets` con una fuente validada de `totalAssets()` cuando el vault use estrategias externas.
2. Desplegar el Subgraph EVM estándar en Subgraph Studio y validar una query GraphQL real.
3. Crear un dashboard mínimo con tabla de salud, radar de incidentes y detalle de una bóveda.
4. Probar una anomalía reproducible en un entorno controlado y documentarla como simulación.

## Validación en vivo — 2026-09-05

Comandos probados desde la raíz del repositorio con el token local en `.substreams.env` (no versionado):

```bash
cargo build --release --target wasm32-unknown-unknown
substreams build substreams.yaml
substreams run -e mainnet.eth.streamingfast.io:443 argus4626-v0.1.0.spkg map_events -s 18941135 -t +5 -o jsonl
substreams run -e mainnet.eth.streamingfast.io:443 argus4626-v0.1.0.spkg graph_out -s 18941135 -t +1 -o jsonl
```

Resultado:

- `substreams build` genera `argus4626-v0.1.0.spkg` sin errores.
- `map_events` procesó 5 bloques reales sin emitir eventos (no hubo `Deposit`/`Withdraw`/`Transfer` de las tres bóvedas en ese rango puntual); es el comportamiento esperado para una ventana tan corta.
- `graph_out` procesó el bloque `18941135` y emitió `EntityChanges` reales con las tres entidades `Vault` (`OPERATION_CREATE`) para Steakhouse USDC, Flagship ETH y yvUSDC, con metadata estática correcta (`protocol`, `assetSymbol`, `assetDecimals`) y contadores en cero por ser el bloque inicial.

Pendiente: correr `graph_out` sobre un rango más largo que contenga una actividad real (depósito/retiro) para confirmar `totalAssets`/`totalSupply`/`sharePrice` no nulos, y decidir cómo mostrar en la demo el aporte de The Graph Market sin fingir una conexión directa del frontend a Substreams (el frontend consume el Standard EVM Subgraph, no `graph_out` directamente).

## Pedido de revisión para otro agente

Revisar este repositorio y responder:

1. ¿Las fórmulas de `src/invariants.rs` son correctas en sus límites?
2. ¿Hay overflow, división implícita incorrecta o falsos positivos obvios?
3. ¿Qué necesita cambiar para conectar correctamente el crate a Substreams?
4. ¿Cuál es el mínimo `map -> store -> graph_out` que puede desplegarse con datos vivos?
5. ¿Qué partes del alcance deben descartarse para llegar a una demo funcional?

No agregar frontend, MCP, nuevos protocolos ni deployment hasta validar ese camino mínimo.
