// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @notice Plain OpenZeppelin ERC-4626 vault for the Argus4626 Sepolia forensics
/// demo: reproduces the textbook donation/inflation pattern (direct asset
/// transfer bypassing deposit()) that the Argus invariant is built to catch.
contract DemoVault is ERC4626 {
    constructor(IERC20 asset_)
        ERC20("Argus Demo Vault", "aDEMO")
        ERC4626(asset_)
    {}
}
