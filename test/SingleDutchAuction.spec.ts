import { describe } from "mocha";
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
use(chaiAsPromised);

const vite = require("@vite/vuilder");

import config from "./vite.config.json";

let provider: any;
let deployer: any;

// contracts
let nftContract: any;
let dutchAuctionContract: any;

// user accounts
let seller: any;
let somebody: any;

// NFT details
const name = "Vite Testing Token";
const symbol = "VITE";
const nftId = 1010;
const startingBid = 10000;
const discountRate = 1;

describe("test Dutchauction", function () {
  before(async function () {
    // provider and account setup
    provider = vite.newProvider(config.networks.local.http);
    deployer = vite.newAccount(config.networks.local.mnemonic, 0, provider);
    console.log("------> deployer", deployer.address);

    // user setup
    seller = vite.newAccount(config.networks.local.mnemonic, 1, provider);
    console.log("------> seller", seller.address);
    somebody = vite.newAccount(config.networks.local.mnemonic, 1, provider);
    console.log("------> somebody", somebody.address);

    // compile NFT contract
    const compiledNFTContracts = await vite.compile("NFT.solpp");
    expect(compiledNFTContracts).to.have.property("NFT");

    // deploy an NFT contract
    nftContract = compiledNFTContracts.NFT;
    nftContract.setDeployer(deployer).setProvider(provider);
    await nftContract.deploy({ params: [name, symbol], responseLatency: 1 });
    expect(nftContract.address).to.be.a("string");
    console.log("------> NFT Contract", nftContract.address);

    // mint
    await nftContract.call("mint", [deployer.address, nftId], {});

    // compile contracts
    const compiledDutchAuctionContracts = await vite.compile(
      "SingleDutchAuction.solpp"
    );

    expect(compiledDutchAuctionContracts).to.have.property(
      "SingleDutchAuction"
    );

    // deploy an dutchAuction contract
    dutchAuctionContract = compiledDutchAuctionContracts.SingleDutchAuction;
    dutchAuctionContract.setDeployer(deployer).setProvider(provider);
    const deployment = await dutchAuctionContract.deploy({
      params: [nftContract.address, nftId, startingBid, discountRate],
      responseLatency: 1,
    });

    expect(dutchAuctionContract.address).to.be.a("string");
    console.log("------> Dutch Auction Contract", dutchAuctionContract.address);
  });

  describe("setup contract", () => {
    it("create contracts", async function (done) {
      // compile Dutch Auction contract

      done();
    });
  });

  // describe("getPrice", function () {
  //   context("give price of auction", function () {
  //     it("returns the current auction price", async function (done) {
  //       const price = await dutchAuctionContract.query("getPrice", []);
  //       console.log("GET PRICE", price);
  //     });
  //   });
  describe("get auction price", function () {
    console.log("start");
    it("provide price of auction", async function () {
      console.log(dutchAuctionContract.address);
      await dutchAuctionContract.waitForHeight(1);
      // const price = await dutchAuctionContract.query("getPrice", []);
    });
  });
});
