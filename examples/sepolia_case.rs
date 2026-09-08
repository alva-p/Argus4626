use argus4626::invariants::{detect_inflation, VaultState};
use primitive_types::U256;

fn main() {
    // Real values captured from Sepolia DemoVault 0x099CaB8F6B806B99CDAb9FB120ae8D684F8E6Ddd
    // before/after tx 0x0748967ad9b718686a9270dc5a415804cab7b0e63bd51dbb62142232beef4fc2 (block 11662343).
    let previous = VaultState {
        total_assets: U256::from(1_000_000_000_000_000_000_000u128),
        total_supply: U256::from(1_000_000_000_000_000_000_000u128),
    };
    let current = VaultState {
        total_assets: U256::from(1_200_000_000_000_000_000_000u128),
        total_supply: U256::from(1_000_000_000_000_000_000_000u128),
    };
    let alert = detect_inflation(previous, current);
    println!("{:?}", alert);
}
