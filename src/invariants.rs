use primitive_types::U256;
use uint::construct_uint;

// U256 * U256 * basis-points can exceed 512 bits at the uint256 boundary.
construct_uint! {
    pub struct U1024(16);
}

pub const BPS_DENOMINATOR: u64 = 10_000;
pub const INFLATION_THRESHOLD_BPS: u64 = 500;
pub const LIQUIDITY_DRAIN_THRESHOLD_BPS: u64 = 3_500;
pub const CRASH_THRESHOLD_BPS: u64 = 500;
pub const UNBACKED_MINT_THRESHOLD_BPS: u64 = 500;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VaultState {
    pub total_assets: U256,
    pub total_supply: U256,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlertType {
    DonationInflation,
    LiquidityDrain,
    SharePriceCrash,
    UnbackedMint,
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

// True when a's share price exceeds b's share price by more than `bps` (in
// addition to parity, i.e. bps=10_500 means "a is more than 5% pricier than b").
// Shared by every threshold check below so the overflow-safe U1024 math lives once.
fn price_ratio_gt(a: VaultState, b: VaultState, bps: u64) -> bool {
    let left = widen(a.total_assets) * widen(b.total_supply) * U1024::from(BPS_DENOMINATOR);
    let right = widen(b.total_assets) * widen(a.total_supply) * U1024::from(bps);
    left > right
}

pub fn detect_inflation(previous: VaultState, current: VaultState) -> Option<Alert> {
    if previous.total_assets.is_zero()
        || previous.total_supply.is_zero()
        || current.total_supply != previous.total_supply
        || current.total_assets <= previous.total_assets
    {
        return None;
    }

    price_ratio_gt(current, previous, BPS_DENOMINATOR + INFLATION_THRESHOLD_BPS).then_some(Alert {
        alert_type: AlertType::DonationInflation,
        severity: Severity::Critical,
    })
}

/// Assets drop sharply while supply stays flat: loss of funds (exploit, bad debt).
pub fn detect_share_price_crash(previous: VaultState, current: VaultState) -> Option<Alert> {
    if previous.total_assets.is_zero()
        || previous.total_supply.is_zero()
        || current.total_supply != previous.total_supply
        || current.total_assets >= previous.total_assets
    {
        return None;
    }

    // previous_price / current_price > 1 + threshold, the mirror of detect_inflation.
    // ponytail: reciprocal threshold, not an exact symmetric percentage drop — fine for a heuristic alert.
    price_ratio_gt(previous, current, BPS_DENOMINATOR + CRASH_THRESHOLD_BPS).then_some(Alert {
        alert_type: AlertType::SharePriceCrash,
        severity: Severity::Critical,
    })
}

/// Supply jumps while assets stay flat: shares minted without matching backing.
pub fn detect_unbacked_mint(previous: VaultState, current: VaultState) -> Option<Alert> {
    if previous.total_assets.is_zero()
        || previous.total_supply.is_zero()
        || current.total_assets != previous.total_assets
        || current.total_supply <= previous.total_supply
    {
        return None;
    }

    price_ratio_gt(
        previous,
        current,
        BPS_DENOMINATOR + UNBACKED_MINT_THRESHOLD_BPS,
    )
    .then_some(Alert {
        alert_type: AlertType::UnbackedMint,
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

    #[test]
    fn flags_price_crash_without_supply_change() {
        assert_eq!(
            detect_share_price_crash(state(100, 100), state(90, 100)),
            Some(Alert {
                alert_type: AlertType::SharePriceCrash,
                severity: Severity::Critical,
            })
        );
    }

    #[test]
    fn ignores_normal_withdraw_as_crash() {
        assert_eq!(
            detect_share_price_crash(state(100, 100), state(90, 90)),
            None
        );
    }

    #[test]
    fn flags_unbacked_mint_without_asset_change() {
        assert_eq!(
            detect_unbacked_mint(state(100, 100), state(100, 120)),
            Some(Alert {
                alert_type: AlertType::UnbackedMint,
                severity: Severity::Critical,
            })
        );
    }

    #[test]
    fn ignores_normal_deposit_as_unbacked_mint() {
        assert_eq!(detect_unbacked_mint(state(100, 100), state(106, 106)), None);
    }

    #[test]
    fn does_not_overflow_crash_at_uint256_boundary() {
        assert_eq!(
            detect_share_price_crash(
                VaultState {
                    total_assets: U256::MAX,
                    total_supply: U256::MAX,
                },
                VaultState {
                    total_assets: U256::MAX / U256::from(2u64),
                    total_supply: U256::MAX,
                }
            )
            .map(|alert| alert.alert_type),
            Some(AlertType::SharePriceCrash)
        );
    }
}
