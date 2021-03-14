// migrations/2_deploy.js
require('dotenv').config()

var Web3 = require('web3');
const BaconToken = artifacts.require("BaconToken");
const ten_million = Web3.utils.toWei('100000000', 'ether');

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(BaconToken, 'BACON', 'BACON', ten_million);
  baconTokenInstance = await BaconToken.deployed();
  if (process.env.MINT_TO) {
    await baconTokenInstance.mint(process.env.MINT_TO, ten_million);
  }
};
