use primitive_types::U256;
use uint::construct_uint;

// U256 * U256 * basis-points can exceed 512 bits at the uint256 boundary.
construct_uint! {
    pub struct U1024(16);
}

pub const BPS_DENOMINATOR: u64 = 10_000;
pub const INFLATION_THRESHOLD_BPS: u64 = 500;
pub const LIQUIDITY_DRAIN_THRESHOLD_BPS: u64 = 3_500;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VaultState {
    pub total_assets: U256,
    pub total_supply: U256,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlertType {
    DonationInflation,
    LiquidityDrain,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Critical,
    Warning,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Alert {
    pub alert_type: AlertType,
    pub severity: Severity,
}

fn widen(value: U256) -> U1024 {
    let bytes = value.to_big_endian();
    U1024::from_big_endian(&bytes)
}

pub fn detect_inflation(previous: VaultState, current: VaultState) -> Option<Alert> {
    if previous.total_assets.is_zero()
        || previous.total_supply.is_zero()
        || current.total_supply != previous.total_supply
        || current.total_assets <= previous.total_assets
    {
        return None;
    }

    // Compare current_price / previous_price > 1 + threshold without floats.
    let left =
        widen(current.total_assets) * widen(previous.total_supply) * U1024::from(BPS_DENOMINATOR);
    let right = widen(previous.total_assets)
        * widen(current.total_supply)
        * U1024::from(BPS_DENOMINATOR + INFLATION_THRESHOLD_BPS);

    (left > right).then_some(Alert {
        alert_type: AlertType::DonationInflation,
        severity: Severity::Critical,
    })
}

pub fn detect_liquidity_drain(withdrawn: U256, available: U256) -> Option<Alert> {
    if withdrawn.is_zero() {
        return None;
    }

    let left = widen(withdrawn) * U1024::from(BPS_DENOMINATOR);
    let right = (widen(available) + widen(withdrawn)) * U1024::from(LIQUIDITY_DRAIN_THRESHOLD_BPS);

    (left > right).then_some(Alert {
        alert_type: AlertType::LiquidityDrain,
        severity: Severity::Warning,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(assets: u64, supply: u64) -> VaultState {
        VaultState {
            total_assets: U256::from(assets),
            total_supply: U256::from(supply),
        }
    }

    #[test]
    fn flags_price_jump_without_supply_change() {
        assert_eq!(
            detect_inflation(state(100, 100), state(106, 100)),
            Some(Alert {
                alert_type: AlertType::DonationInflation,
                severity: Severity::Critical,
            })
        );
    }

    #[test]
    fn ignores_normal_deposit() {
        assert_eq!(detect_inflation(state(100, 100), state(106, 106)), None);
    }

    #[test]
    fn ignores_empty_baseline_without_share_price() {
        assert_eq!(detect_inflation(state(0, 0), state(10_000, 1)), None);
    }

    #[test]
    fn flags_withdrawal_window_above_threshold() {
        assert_eq!(
            detect_liquidity_drain(U256::from(36u64), U256::from(64u64)),
            Some(Alert {
                alert_type: AlertType::LiquidityDrain,
                severity: Severity::Warning,
            })
        );
    }

    #[test]
    fn supports_uint256_scale_without_float_rounding() {
        let assets = U256::from(1u64) << 200;
        assert_eq!(
            detect_inflation(
                VaultState {
                    total_assets: assets,
                    total_supply: U256::from(1u64),
                },
                VaultState {
                    total_assets: assets * U256::from(106u64) / U256::from(100u64),
                    total_supply: U256::from(1u64),
                }
            )
            .map(|alert| alert.alert_type),
            Some(AlertType::DonationInflation)
        );
    }

    #[test]
    fn does_not_overflow_at_uint256_boundary() {
        assert_eq!(detect_liquidity_drain(U256::from(1u64), U256::MAX), None);
    }

    #[test]
    fn handles_maximum_uint256_products() {
        assert_eq!(
            detect_inflation(
                VaultState {
                    total_assets: U256::MAX / U256::from(2u64),
                    total_supply: U256::MAX,
                },
                VaultState {
                    total_assets: U256::MAX,
                    total_supply: U256::MAX,
                }
            )
            .map(|alert| alert.alert_type),
            Some(AlertType::DonationInflation)
        );
    }

    #[test]
    fn handles_maximum_liquidity_values() {
        assert_eq!(
            detect_liquidity_drain(U256::MAX, U256::MAX),
            Some(Alert {
                alert_type: AlertType::LiquidityDrain,
                severity: Severity::Warning,
            })
        );
    }
}
