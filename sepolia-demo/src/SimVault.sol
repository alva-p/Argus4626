// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/// @notice Sepolia-only demo vault for incident patterns a plain ERC4626 can't
/// reproduce on its own: a standard vault always ties supply and assets
/// together, so simulating a loss or an unbacked mint needs an owner-only
/// escape hatch. Used only to generate real, on-chain evidence for the
/// Argus SharePriceCrash and UnbackedMint invariants — not a real vault.
contract SimVault is ERC4626, Ownable {
    constructor(IERC20 asset_)
        ERC20("Argus Sim Vault", "aSIM")
        ERC4626(asset_)
        Ownable(msg.sender)
    {}

    /// @notice Moves assets out of the vault without touching share supply,
    /// reproducing a loss of funds / bad debt (Argus SharePriceCrash pattern).
    function simulateLoss(uint256 amount) external onlyOwner {
        require(IERC20(asset()).transfer(owner(), amount), "transfer failed");
    }

    /// @notice Mints shares with no matching deposit, reproducing an unbacked
    /// mint (Argus UnbackedMint pattern).
    function simulateUnbackedMint(address to, uint256 shares) external onlyOwner {
        _mint(to, shares);
    }
}
