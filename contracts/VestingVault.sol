/*
Original work taken from https://gist.github.com/rstormsf/7cfb0c6b7a835c0c67b4a394b4fd9383
Simplified VestingVault for one grant per address implementation from https://github.com/tapmydata/tap-protocol/blob/main/contracts/VestingVault.sol

This version improves on the implementation in the following ways:
- Vesting has been made to support per-month instead of per-day
- All time calculations now use SafeMath to solve issues comparing execution time with cliff time. SafeMath and primitive operators cannot be compared properly.
*/
// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VestingVault is Ownable {
    using SafeMath for uint256;
    using SafeMath for uint16;

    struct Grant {
        uint256 startTime;
        uint256 amount;
        uint16 vestingDuration;
        uint16 monthsClaimed;
        uint256 totalClaimed;
        address recipient;
    }

    event GrantAdded(address indexed recipient);
    event GrantTokensClaimed(address indexed recipient, uint256 amountClaimed);
    event GrantRevoked(address recipient, uint256 amountVested, uint256 amountNotVested);

    ERC20 public token;
    
    mapping (address => Grant) private tokenGrants;

    uint256 public totalVestingCount;

    constructor(ERC20 _token) public {
        require(address(_token) != address(0));
        token = _token;
    }
    
    function addTokenGrant(
        address _recipient,
        uint256 _amount,
        uint16 _vestingDurationInMonths,
        uint16 _vestingCliffInMonths    
    ) 
        external
        onlyOwner
    {
        require(tokenGrants[_recipient].amount == 0, "Grant already exists, must revoke first.");
        require(_vestingDurationInMonths <= 25*12, "Duration greater than 25 years");
        require(_vestingCliffInMonths <= 10*12, "Cliff greater than 10 years");

        uint256 amountVestedPerMonth = _amount.div(_vestingDurationInMonths);
        require(amountVestedPerMonth > 0, "amountVestedPerMonth > 0");

        // Transfer the grant tokens under the control of the vesting contract
        require(token.transferFrom(owner(), address(this), _amount));

        Grant memory grant = Grant({
            startTime: currentTime().add(_vestingCliffInMonths.mul(30 days)),
            amount: _amount,
            vestingDuration: _vestingDurationInMonths,
            monthsClaimed: 0,
            totalClaimed: 0,
            recipient: _recipient
        });
        tokenGrants[_recipient] = grant;
        emit GrantAdded(_recipient);
    }

    /// @notice Allows a grant recipient to claim their vested tokens. Errors if no tokens have vested
    function claimVestedTokens() external {
        uint16 monthsVested;
        uint256 amountVested;
        (monthsVested, amountVested) = calculateGrantClaim(msg.sender);
        require(amountVested > 0, "Vested is 0");

        Grant storage tokenGrant = tokenGrants[msg.sender];
        tokenGrant.monthsClaimed = uint16(tokenGrant.monthsClaimed.add(monthsVested));
        tokenGrant.totalClaimed = uint256(tokenGrant.totalClaimed.add(amountVested));
        
        require(token.transfer(tokenGrant.recipient, amountVested), "no tokens");
        emit GrantTokensClaimed(tokenGrant.recipient, amountVested);
    }

    /// @notice Terminate token grant transferring all vested tokens to the `_recipient`
    /// and returning all non-vested tokens to the contract owner
    /// Secured to the contract owner only
    /// @param _recipient address of the token grant recipient
    function revokeTokenGrant(address _recipient) 
        external 
        onlyOwner
    {
        Grant storage tokenGrant = tokenGrants[_recipient];
        uint16 monthsVested;
        uint256 amountVested;
        (monthsVested, amountVested) = calculateGrantClaim(_recipient);

        uint256 amountNotVested = (tokenGrant.amount.sub(tokenGrant.totalClaimed)).sub(amountVested);

        require(token.transfer(owner(), amountNotVested));
        require(token.transfer(_recipient, amountVested));

        tokenGrant.startTime = 0;
        tokenGrant.amount = 0;
        tokenGrant.vestingDuration = 0;
        tokenGrant.monthsClaimed = 0;
        tokenGrant.totalClaimed = 0;
        tokenGrant.recipient = address(0);

        emit GrantRevoked(_recipient, amountVested, amountNotVested);
    }

    function getGrantStartTime(address _recipient) public view returns(uint256) {
        Grant storage tokenGrant = tokenGrants[_recipient];
        return tokenGrant.startTime;
    }

    function getGrantAmount(address _recipient) public view returns(uint256) {
        Grant storage tokenGrant = tokenGrants[_recipient];
        return tokenGrant.amount;
    }

    /// @notice Calculate the vested and unclaimed months and tokens available for `_grantId` to claim
    /// Due to rounding errors once grant duration is reached, returns the entire left grant amount
    /// Returns (0, 0) if cliff has not been reached
    function calculateGrantClaim(address _recipient) private view returns (uint16, uint256) {
        Grant storage tokenGrant = tokenGrants[_recipient];

        require(tokenGrant.totalClaimed < tokenGrant.amount, "Grant fully claimed");

        // For grants created with a future start date, that hasn't been reached, return 0, 0
        if (currentTime() < tokenGrant.startTime) {
            return (0, 0);
        }

        // Check cliff was reached
        uint elapsedMonths = currentTime().sub(tokenGrant.startTime.sub(30 days)).div(30 days);
     
        // If over vesting duration, all tokens vested
        if (elapsedMonths >= tokenGrant.vestingDuration) {
            uint256 remainingGrant = tokenGrant.amount.sub(tokenGrant.totalClaimed);
            return (tokenGrant.vestingDuration, remainingGrant);
        } else {
            uint16 monthsVested = uint16(elapsedMonths.sub(tokenGrant.monthsClaimed));
            uint256 amountVestedPerMonth = tokenGrant.amount.div(uint256(tokenGrant.vestingDuration));
            uint256 amountVested = uint256(monthsVested.mul(amountVestedPerMonth));
            return (monthsVested, amountVested);
        }
    }

    function currentTime() private view returns(uint256) {
        return block.timestamp;
    }
}