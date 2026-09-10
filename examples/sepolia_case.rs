use argus4626::invariants::{
    detect_inflation, detect_liquidity_drain, detect_share_price_crash, detect_unbacked_mint,
    VaultState,
};
use primitive_types::U256;

fn main() {
    // Donation/inflation: Sepolia DemoVault 0x099CaB8F6B806B99CDAb9FB120ae8D684F8E6Ddd
    // before/after tx 0x0748967ad9b718686a9270dc5a415804cab7b0e63bd51dbb62142232beef4fc2 (block 11662343).
    let previous = VaultState {
        total_assets: U256::from(1_000_000_000_000_000_000_000u128),
        total_supply: U256::from(1_000_000_000_000_000_000_000u128),
    };
    let current = VaultState {
        total_assets: U256::from(1_200_000_000_000_000_000_000u128),
        total_supply: U256::from(1_000_000_000_000_000_000_000u128),
    };
    println!(
        "donation/inflation: {:?}",
        detect_inflation(previous, current)
    );

    // Liquidity drain: LiquidityDemoVault 0x18c5A7ab3602680dd18fB5f074c3662f473c93f1,
    // withdraw() tx 0x88e2687e8233014e22d02cbf37cff822e57e1f4543a042476b835c3af014d30e (block 11672026).
    let withdrawn = U256::from(400_000_000_000_000_000_000u128);
    let available = U256::from(600_000_000_000_000_000_000u128);
    println!(
        "liquidity drain: {:?}",
        detect_liquidity_drain(withdrawn, available)
    );

    // Share price crash: SimVault 0x90bba5d49163dbF3F20C4f4d562307E03Bb34AB0,
    // simulateLoss() tx 0x332a534cf804681ab8a283700bf06cf87775fe49eb4e7294128dfb5f90be7b87 (block 11672034).
    let crash_previous = VaultState {
        total_assets: U256::from(1_000_000_000_000_000_000_000u128),
        total_supply: U256::from(1_000_000_000_000_000_000_000u128),
    };
    let crash_current = VaultState {
        total_assets: U256::from(800_000_000_000_000_000_000u128),
        total_supply: U256::from(1_000_000_000_000_000_000_000u128),
    };
    println!(
        "share price crash: {:?}",
        detect_share_price_crash(crash_previous, crash_current)
    );

    // Unbacked mint: same SimVault, simulateUnbackedMint() tx
    // 0x298782c60809c9d9fad82e7461db30f38fc467a28a49af0ff6906fdf4ad143e9 (block 11672036).
    let mint_previous = VaultState {
        total_assets: U256::from(800_000_000_000_000_000_000u128),
        total_supply: U256::from(1_000_000_000_000_000_000_000u128),
    };
    let mint_current = VaultState {
        total_assets: U256::from(800_000_000_000_000_000_000u128),
        total_supply: U256::from(1_200_000_000_000_000_000_000u128),
    };
    println!(
        "unbacked mint: {:?}",
        detect_unbacked_mint(mint_previous, mint_current)
    );
}
