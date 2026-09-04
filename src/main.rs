use argus4626::invariants::{detect_inflation, AlertType, VaultState};
use primitive_types::U256;

fn main() {
    let previous = VaultState {
        total_assets: U256::from(100u64),
        total_supply: U256::from(100u64),
    };
    let current = VaultState {
        total_assets: U256::from(106u64),
        total_supply: U256::from(100u64),
    };

    assert_eq!(
        detect_inflation(previous, current).map(|alert| alert.alert_type),
        Some(AlertType::DonationInflation)
    );
    println!("Argus4626 ok: donation/inflation invariant detected");
}
