// Load dependencies
const { expect } = require('chai');

// Import utilities from Test Helpers
const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

// Load compiled artifacts
const Bacon = artifacts.require('BaconToken');

const Web3 = require('web3');

// Start test block
contract('Bacon', function ([owner, other]) {

  const cap = new BN('100000000');
  const initialSupply = new BN('50000000');

  beforeEach(async function () {
    this.bacon = await Bacon.new('Bacon', 'BACON', cap);
    await this.bacon.mint(owner, initialSupply);
  });

  it('has correct initial supply', async function () {
    // Store a value
    expect((await this.bacon.totalSupply()).toString()).to.equal(initialSupply.toString());
  });

  it('can mint more tokens', async function () {
    // Store a value
    await this.bacon.mint(owner, initialSupply);
    expect((await this.bacon.totalSupply()).toString()).to.equal(cap.toString());
  });

  it('can not mint beyond cap', async function () {
    // Store a value
    await expectRevert(
      this.bacon.mint(owner, cap),
      "ERC20Capped: cap exceeded"
    );
  });

  it('can burn tokens', async function () {
    const toBurn = new BN('20000000');
    const newSupply = new BN('30000000');
    await this.bacon.burn(toBurn);
    expect((await this.bacon.totalSupply()).toString()).to.equal(newSupply.toString());
  });

  it('has correct name', async function () {
    // Store a value
    expect(await this.bacon.name()).to.equal('Bacon');
  });

  it('has correct symbol', async function () {
    // Store a value
    expect(await this.bacon.symbol()).to.equal('BACON');
  });

  it('can transfer tokens', async function () {
    await this.bacon.transfer(other, 1000);
    expect((await this.bacon.balanceOf(other)).toString()).to.equal("1000");
  });

  it('can block transfer to recipient', async function () {
    const web3Receipt = await this.bacon.blockAccount(other);

    await expectEvent(
      web3Receipt,
      "Blocked",
      [other]
    );

    await expectRevert(
      this.bacon.transfer(other, 1000),
      "ERC20Blockable: token transfer rejected. Receiver is blocked."
    );
    expect((await this.bacon.balanceOf(other)).toString()).to.equal("0");
  });

  it('can block transfer from sender', async function () {
    await this.bacon.transfer(other, 1000);
    newBalance = await this.bacon.balanceOf(owner);
    await this.bacon.blockAccount(other);
    await expectRevert(
      this.bacon.transfer(owner, 1000, { from: other }),
      "ERC20Blockable: token transfer rejected. Sender is blocked."
    );
    expect((await this.bacon.balanceOf(owner)).toString()).to.equal(newBalance.toString());
  });

  it('can unblock account', async function () {
    await this.bacon.blockAccount(other);
    const web3Receipt = await this.bacon.unBlockAccount(other);
    await expectEvent(
      web3Receipt,
      "UnBlocked",
      [other]
    );

    await this.bacon.transfer(other, 1000);
    expect((await this.bacon.balanceOf(other)).toString()).to.equal("1000");
  });

  it('can only be blocked by blocker role account', async function () {
    await expectRevert(
      this.bacon.blockAccount(owner, { from: other }),
      "ERC20Blockable: must have blocker role to block."
    );
  });

  it('can assign blocker role', async function () {
    const role = Web3.utils.keccak256("BLOCKER_ROLE");
    const web3Receipt = await this.bacon.grantRole(role, other);
    await expectEvent(
      web3Receipt,
      "RoleGranted",
      [role, other, owner]
    );
    const account_to_block = '0xcb0510D1c4eA88CcD1F2395D075Af9e831C2F15d';
    await this.bacon.blockAccount(account_to_block, { from: other });
    expect(await this.bacon.isBlocked(account_to_block)).to.equal(true);
  });

  it('can be paused', async function () {
    await this.bacon.transfer(other, 1000);
    expect((await this.bacon.balanceOf(other)).toString()).to.equal("1000");

    // Pause the contract
    const web3Receipt = await this.bacon.pause();
    await expectEvent(
      web3Receipt,
      "Paused",
      [owner]
    );

    await expectRevert(
      this.bacon.transfer(other, 1000),
      "ERC20Pausable: token transfer while paused"
    );

    expect((await this.bacon.balanceOf(other)).toString()).to.equal("1000");
  });

  it('can only be paused by pauser role', async function () {
    await expectRevert(
      this.bacon.pause({ from: other }),
      "ERC20PresetMinterPauser: must have pauser role to pause"
    );
  });

  it('can be un-paused', async function () {
    await this.bacon.pause();

    await expectRevert(
      this.bacon.transfer(other, 1000),
      "ERC20Pausable: token transfer while paused"
    );

    const web3Receipt = await this.bacon.unpause();
    await expectEvent(
      web3Receipt,
      "Unpaused",
      [owner]
    );

    await this.bacon.transfer(other, 1000);
    expect((await this.bacon.balanceOf(other)).toString()).to.equal("1000");
  });

  it('can only be un-paused by pauser role', async function () {
    await expectRevert(
      this.bacon.unpause({ from: other }),
      "ERC20PresetMinterPauser: must have pauser role to unpause"
    );
  });

});
