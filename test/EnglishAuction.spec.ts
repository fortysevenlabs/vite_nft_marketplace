import { describe } from "mocha";
import { expect } from "chai";
const vite = require('@vite/vuilder');
import config from "./vite.config.json";

let provider: any;
let deployer: any;
let nftContract: any;
let englishAuctionContract: any;

const name = 'Vite Testing Token';
const symbol = 'VITE';
const firstTokenId = '1010';
const secondTokenId = '1615';
const startingBid = '1';

describe('test NFT', function () {
  before(async function () {
    provider = vite.newProvider(config.networks.local.http);
    deployer = vite.newAccount(config.networks.local.mnemonic, 0, provider);
    console.log("deployer", deployer.address);

    // compile NFT contract
    const compiledNFTContracts = await vite.compile("NFT.solpp");
    expect(compiledNFTContracts).to.have.property("NFT");
    
    // deploy an NFT contract
    // need to pass params to deploy
    nftContract = compiledNFTContracts.NFT;
    nftContract.setDeployer(deployer).setProvider(provider);
    await nftContract.deploy({params: ["ViteTestingToken", "VITE"], responseLatency: 1});
    expect(nftContract.address).to.be.a("string");
    console.log(nftContract.address);

    // mint
    await nftContract.call('mint', [deployer.address, firstTokenId], {});
    await nftContract.call('mint', [deployer.address, secondTokenId], {});

    // compile English Auction contract
    const compiledEnglishAuctionContracts = await vite.compile("EnglishAuction.solpp");
    expect(compiledEnglishAuctionContracts).to.have.property("EnglishAuction");

    // deploy an englishAuction contract
    // need to pass params to deploy
    englishAuctionContract = compiledNFTContracts.NFT;
    englishAuctionContract.setDeployer(deployer).setProvider(provider);
    await englishAuctionContract.deploy({ params: [nftContract.address, firstTokenId, 1] });
    expect(englishAuctionContract.address).to.be.a("string");
    console.log(englishAuctionContract.address);
  });


    describe("start", () => {
        // it("should revert if auction is not started by seller", async () => {

        // });

        // it("should transfer NFT to contract", async () => {

        // });

        // it("should update auction started to true", async () => {

        // });

        // it("should set auction end time accurately", async () => {

        // });

        it("should emit a start event", async () => {
            // let events = await a.getPastEvents('Start', {fromHeight: 2, toHeight: 3});
            let events = await englishAuctionContract.getPastEvents('Start');
            expect(events).to.be.an('array').with.length(1);
        });
    });
});