// Load dependencies
const { expect } = require('chai');

// Import utilities from Test Helpers
const { BN } = require('@openzeppelin/test-helpers');

// Load compiled artifacts
const Bacon = artifacts.require('BaconToken');

const Web3 = require('web3');

// Start test block
contract('Bacon', function ([owner, other]) {

  const totalSupply = new BN('10000000');
  const initialSupply = new BN('10000000');

  beforeEach(async function () {
    this.bacon = await Bacon.new('Bacon', 'BACON', totalSupply);
  });

  it('has correct initial supply', async function () {
    // Store a value
    expect((await this.bacon.totalSupply()).toString()).to.equal(initialSupply.toString());
  });

  it('can burn tokens', async function () {
    const toBurn = new BN('2000000');
    const newSupply = new BN('8000000');
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
});
