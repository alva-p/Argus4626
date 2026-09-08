# Sepolia demo case — deploy + video runbook

Estado: **listo para ejecutar**, dejado pendiente de la sesión 2026-09-06 para mañana.

## Por qué este caso

Los tres vaults reales trackeados (Steakhouse USDC, Flagship ETH, yvUSDC) están sincronizados hasta el bloque `25914197` con **cero alertas en toda su historia**: son vaults sanos, nunca dispararon el invariante. No existe un incidente histórico real y verificable que calce con nuestro patrón exacto (se investigó sDOLA/LlamaLend — es manipulación de oráculo atómica, no aplica).

Decisión tomada: reproducir en Sepolia el **ataque de "primer depositante" (first depositor inflation attack)**, la vulnerabilidad de referencia del estándar ERC-4626, documentada por OpenZeppelin, Zellic y MixBytes. No es un incidente inventado sin sustento — es el patrón real que motivó el invariante de `detect_inflation` desde el día uno.

Se graba en video: video se edita después, así que el material que mejor queda en pantalla es la propia UI (una card roja "CRITICAL" se puede resaltar/zoomear en edición; texto de terminal no mejora por más que se edite). Por eso la alerta de Sepolia **tiene que aparecer en el dashboard real**, no solo en una terminal.

Para lograrlo sin tocar el Subgraph de mainnet: un segundo Subgraph Studio minimalista, dedicado solo a Sepolia y a nuestro `DemoVault`, reusando el mismo `schema.graphql` y casi el mismo `mapping.ts` que ya existen en `subgraph/`. No es un pipeline Substreams nuevo (eso sí sería scope creep) — es el mismo Standard EVM Subgraph que ya sabemos deployar, apuntado a una red y un vault distintos.

## Ya hecho (2026-09-06)

- Foundry instalado (`forge`/`cast` v1.8.1) en `~/.foundry/bin`.
- Proyecto `sepolia-demo/` inicializado con `forge init`, dependencia `OpenZeppelin/openzeppelin-contracts` (v5.7.0) instalada.
- `sepolia-demo/src/DemoAsset.sol`: ERC-20 simple con `mint()` público (activo solo en testnet).
- `sepolia-demo/src/DemoVault.sol`: vault ERC-4626 plano sobre OpenZeppelin (`ERC4626`), sin modificaciones — vulnerable al patrón clásico porque no fija un depósito inicial de un admin.
- `forge build` compila limpio.
- `.env.example` con `SEPOLIA_RPC_URL` y `PRIVATE_KEY`; `.gitignore` de la carpeta ignora `.env`, `lib/`, `cache/`, `out/`, `broadcast/`.

## Pendiente antes de empezar

- [ ] Completar `sepolia-demo/.env` (RPC de Sepolia + private key de la wallet de testnet). No pegar la key en el chat.
- [ ] Confirmar que la wallet tiene ETH de Sepolia para gas (2 deploys + 3-4 txs).

## Paso a paso del deploy

Todos los comandos se corren desde `sepolia-demo/` con `source .env` cargado en el shell (nunca hacer `cat .env`).

```bash
cd sepolia-demo
source .env
export PATH="$PATH:$HOME/.foundry/bin"
```

### 1. Deploy del asset de prueba

```bash
forge create src/DemoAsset.sol:DemoAsset \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

Anotar: dirección del contrato (`ASSET`), bloque, tx hash.

### 2. Deploy del vault

```bash
forge create src/DemoVault.sol:DemoVault \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --constructor-args <ASSET>
```

Anotar: dirección del contrato (`VAULT`), bloque, tx hash.

### 3. Mint + depósito real (estado "antes")

```bash
MY_ADDRESS=$(cast wallet address --private-key "$PRIVATE_KEY")

# Mint 1000 aUSDC (6 decimales) a mi propia wallet
cast send <ASSET> "mint(address,uint256)" "$MY_ADDRESS" 1000000000 \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$PRIVATE_KEY"

# Aprobar el vault
cast send <ASSET> "approve(address,uint256)" <VAULT> 1000000000 \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$PRIVATE_KEY"

# Depósito real: 1000 aUSDC -> shares
cast send <VAULT> "deposit(uint256,address)" 1000000000 "$MY_ADDRESS" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$PRIVATE_KEY"
```

Leer y anotar el estado "antes" (bloque + tx del depósito + estos tres valores):

```bash
cast call <VAULT> "totalAssets()(uint256)" --rpc-url "$SEPOLIA_RPC_URL"
cast call <VAULT> "totalSupply()(uint256)" --rpc-url "$SEPOLIA_RPC_URL"
cast call <VAULT> "convertToAssets(uint256)(uint256)" 1000000 --rpc-url "$SEPOLIA_RPC_URL"
```

### 4. La donation (estado "después")

Transferencia directa del asset al vault, **sin pasar por `deposit()`** — esto es la donation:

```bash
cast send <ASSET> "mint(address,uint256)" "$MY_ADDRESS" 200000000 \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$PRIVATE_KEY"

cast send <ASSET> "transfer(address,uint256)" <VAULT> 200000000 \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$PRIVATE_KEY"
```

200 aUSDC de donation sobre 1000 depositados = +20% en `totalAssets` con `totalSupply` sin cambios → dispara el invariante (umbral real: 5%).

Anotar bloque + tx hash de esta transacción — **esta es la transacción del incidente**.

Releer y anotar el estado "después":

```bash
cast call <VAULT> "totalAssets()(uint256)" --rpc-url "$SEPOLIA_RPC_URL"
cast call <VAULT> "totalSupply()(uint256)" --rpc-url "$SEPOLIA_RPC_URL"
cast call <VAULT> "convertToAssets(uint256)(uint256)" 1000000 --rpc-url "$SEPOLIA_RPC_URL"
```

### 5. Confirmar con el código real del invariante (sanity check interno, no es lo que se graba)

Con los `totalAssets`/`totalSupply` "antes" y "después" ya capturados, correr el mismo código Rust que usa el pipeline de producción, solo para confirmar que el invariante realmente clasifica el caso como `CRITICAL` antes de invertir tiempo en el Subgraph de Sepolia:

```bash
cd ..  # raíz del repo
cargo run --example sepolia_case 2>/dev/null || true
```

Si no existe el example, crear `examples/sepolia_case.rs` con los valores reales capturados:

```rust
use argus4626::invariants::{detect_inflation, VaultState};
use primitive_types::U256;

fn main() {
    let previous = VaultState { total_assets: U256::from(<ANTES_ASSETS>u64), total_supply: U256::from(<ANTES_SUPPLY>u64) };
    let current = VaultState { total_assets: U256::from(<DESPUES_ASSETS>u64), total_supply: U256::from(<DESPUES_SUPPLY>u64) };
    let alert = detect_inflation(previous, current);
    println!("{:?}", alert);
}
```

Correr con `cargo run --example sepolia_case`. Debe imprimir `Some(Alert { alert_type: DonationInflation, severity: Critical })`. Esto es solo una verificación de trabajo, no parte del guion — lo que se graba es el paso 6.

### 6. Subgraph de Sepolia para que la alerta viva en el dashboard

Copiar la estructura de `subgraph/` a `subgraph-sepolia/` y adaptar:

- `schema.graphql`: igual, sin cambios.
- `subgraph.yaml`: un solo `dataSource`, `network: sepolia`, `address: <VAULT>`, mismo `abi/erc4626.json`, `startBlock` = bloque de deploy del `DemoVault` (paso 2).
- `src/mapping.ts`: simplificar `metadata()` para devolver directo los datos fijos de este vault (protocolo `"Argus Demo"`, nombre `"Sepolia Inflation Demo"`, asset `<ASSET>`, símbolo `aUSDC`, 6/6 decimales) — ya no hace falta la rama por dirección porque hay un solo vault.

```bash
cd subgraph-sepolia
npx --yes @graphprotocol/graph-cli@0.98.1 codegen subgraph.yaml
npx --yes @graphprotocol/graph-cli@0.98.1 build subgraph.yaml
graph auth  # o graph deploy con --deploy-key, mismo flujo que el subgraph de mainnet
graph deploy --node https://api.studio.thegraph.com/deploy/ argus-4626-sepolia-demo subgraph.yaml
```

Confirmar con una query real contra el nuevo endpoint (mismo estilo que se usó para validar el subgraph de mainnet) que aparece el `Vault` y el `SecurityAlert` con severidad `CRITICAL`.

### 7. Mostrarlo en el dashboard

Frontend: extraer el JSX de `/vault/[id]/page.tsx` a un componente compartido (`VaultDetailView`) que reciba los datos ya resueltos, y agregar una ruta fija `/vault/sepolia-demo` que llama a `getVaultDetail(vaultAddress, sepoliaEndpoint)` — se agrega un segundo parámetro opcional de endpoint a `getVaultDetail` (hoy toma el endpoint fijo del módulo). Nueva env var `ARGUS_SEPOLIA_GRAPH_ENDPOINT` en `.env.local`. Así la página de detalle real (historial, explicación, bloque/tx/Etherscan) muestra el incidente de Sepolia con la misma UI que cualquier otro vault — sin mezclar datos de Sepolia con el dashboard principal de mainnet.

### 8. Guardar evidencia

En `PROJECT_CONTEXT.md`, agregar una sección "Caso Sepolia — evidencia real" con:

- direcciones de `DemoAsset` y `DemoVault`;
- bloque y tx hash del depósito;
- bloque y tx hash de la donation;
- `totalAssets`/`totalSupply`/`sharePrice` antes y después;
- endpoint del Subgraph de Sepolia;
- link a Etherscan Sepolia de la tx de la donation.

## Guion del video (actualiza PLAN.md §12)

Duración objetivo: ~3:25. Grabación de pantalla continua, sin cortes que parezcan mockeados. Guion palabra por palabra en inglés simple — leer o practicar antes de grabar. Tab "Demo" agregado al sidebar (`frontend/src/app/page.tsx`), apunta directo a `/vault/sepolia-demo` — usarlo en vez de tipear la URL.

**0:00–0:15 — Intro.**

> "Hi, I'm Alvaro. This is Argus4626, my project for ETHOnline 2026, built on The Graph."

**0:15–0:45 — Problem.**

> "ERC-4626 is a standard for DeFi vaults. Every vault has the same functions: deposit, withdraw, total assets. But there's no standard way to watch these vaults for risk. Today, every protocol builds its own custom monitoring, or has none at all. That means dangerous patterns, like a vault's price jumping without a real reason, can go unnoticed."

**0:45–1:10 — Solution.**

> "Argus4626 is one pipeline that reads any ERC-4626 vault the same way, using Substreams and Subgraphs from The Graph, and flags dangerous patterns with real on-chain proof: the block, the transaction, and a simple explanation."

**1:10–1:35 — Diagram (mostrar `docs/argus4626-architecture.svg`).**

> "Before I show the dashboard, here's a quick look at how it works. This diagram helped me stay clear on what's real and what's not, so let me walk through it fast. Data comes from Ethereum, through one shared entry point for every vault. Then it splits into two paths: Substreams, in orange, is the reusable module — proven live on real blocks. The Subgraph, in green, is what actually powers the dashboard you're about to see."

**1:35–2:00 — Dashboard principal, vaults reales.**

> "This is the live dashboard. Three real vaults, from Morpho and Yearn, side by side, same table, same rules. Right now, all three are healthy — zero alerts. That's real data, live from The Graph."

**2:00–2:15 — Transición honesta + click en "Demo" en el sidebar.**

> "These vaults never had an incident, because they're well built. So to show detection in action, I built a test vault on a testnet, and reproduced a real, well-known attack. [click "Demo" in the sidebar]"

**2:15–2:55 — Incidente real en Sepolia (señalar cada número mientras lo decís).**

> "This vault started with 1000 tokens deposited, and 1000 shares — so the price was 1. [point to the Share Price History chart, the jump from 1.0 to 1.2] Then someone sent 200 more tokens straight into the vault, without depositing normally. That's called a donation. Now the vault holds 1200 tokens [point to Total assets], but still only 1000 shares [point to Total supply]. The price jumped to 1.2 [point to Share price], but nobody paid for that jump — that's suspicious. [scroll to Alert history] And here, Argus catches it: a critical alert, a plain explanation, and the exact block. [click VIEW TX] This opens Etherscan — a real transaction, real numbers, not a mock."

**2:55–3:10 — Conectar con producción.**

> "Same page, same code, back on a real mainnet vault. One module, same rules, any ERC-4626 vault."

**3:10–3:25 — Cierre.**

> "That's Argus4626: one reusable pipeline, live data from The Graph, and clear evidence for every alert. Thanks for watching."

## Checklist

- [x] Completar `sepolia-demo/.env`.
- [x] Deploy `DemoAsset` + `DemoVault` en Sepolia (pasos 1–2).
- [x] Depósito real + captura de estado "antes" (paso 3).
- [x] Donation real + captura de estado "después" y de la tx del incidente (paso 4).
- [x] Sanity check con `examples/sepolia_case.rs`, confirmar `CRITICAL` antes de seguir (paso 5).
- [x] Deployar `subgraph-sepolia/` en Subgraph Studio y validar `SecurityAlert` con una query real (paso 6). Nota: se agregó un segundo `dataSource` sobre el `Transfer` del asset — el vault no emite ningún evento propio en una donation directa.
- [x] Extraer `VaultDetailView` compartido y agregar `/vault/sepolia-demo` en el frontend (paso 7).
- [x] Documentar todo en `PROJECT_CONTEXT.md` (paso 8).
- [x] Diagrama de arquitectura en excalidraw.com → `docs/argus4626-architecture.svg`.
- [ ] Grabar el video de ~3:15 siguiendo el guion de arriba (en inglés, palabra por palabra) — el momento clave se graba **en el dashboard**, no en una terminal.
- [ ] Revisión final: README, secrets fuera de git, PR a `main`.
