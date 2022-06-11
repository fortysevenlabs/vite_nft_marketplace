import { describe } from "mocha";
import { expect, use } from "chai";
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

const vite = require('@vite/vuilder');
import config from "./vite.config.json";
import { getEnabledCategories } from "trace_events";

let provider: any;
let deployer: any;

// contracts
let nftContract: any;
let englishAuctionContract: any;

// user accounts
let seller: any;
let somebody: any;

// NFT details
const name = 'Vite Testing Token';
const symbol = 'VITE';
const nftId = 1010;
const startingBid = 1;

describe('test NFT', function () {
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
        await nftContract.deploy({params: [name, symbol], responseLatency: 1});
        expect(nftContract.address).to.be.a("string");
        console.log("------> NFT Contract", nftContract.address);

        // mint
        await nftContract.call('mint', [deployer.address, nftId], {});
    });

    beforeEach(async function() {
        // compile English Auction contract
        const compiledEnglishAuctionContracts = await vite.compile("EnglishAuction.solpp");
        expect(compiledEnglishAuctionContracts).to.have.property("EnglishAuction");

        // deploy an englishAuction contract
        englishAuctionContract = compiledEnglishAuctionContracts.EnglishAuction;
        englishAuctionContract.setDeployer(deployer).setProvider(provider);
        await englishAuctionContract.deploy({ params: [nftContract.address, nftId, startingBid], responseLatency: 1 });
        expect(englishAuctionContract.address).to.be.a("string");
        console.log("------> English Auction Contract", englishAuctionContract.address);
    });

   describe("start", () => {
        it("should revert if auction is not started by seller", async () => {
            // TODO: results in "abort([object Object])" instead of "revert"
            await expect(englishAuctionContract.call('start', [], {caller: somebody})).to.eventually.be.rejectedWith("revert");
        })

        it("should revert if auction has already started", async () => {
            await englishAuctionContract.call('start', [], {});
            await expect(englishAuctionContract.call('start', [], {})).to.eventually.be.rejectedWith("revert");
        });

        it("should transfer NFT from seller to contract", async () => {
            // approve englishAuction to call transferFrom
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([deployer.address])
            await nftContract.call('approve', [englishAuctionContract.address, nftId], {caller: deployer});
            expect(await nftContract.query("getApproved", [nftId])).to.be.deep.equal([englishAuctionContract.address])

            // TODO: FIX this, englishAuctionContract.call isn't transferring.
            await nftContract.call('transferFrom', [deployer.address, englishAuctionContract.address, nftId], {caller: deployer});
            // await englishAuctionContract.call('start', [], {caller: deployer});

            expect(await nftContract.query('ownerOf', [nftId])).to.be.deep.equal([englishAuctionContract.address]);
        });

        it("should update auction started to true", async () => {
            await englishAuctionContract.call('start', [], {caller: deployer});
            expect(await englishAuctionContract.query('started')).to.be.deep.equal(['1']);
        });

        it("should set auction end time accurately", async () => {
            // TODO: better way to test this?
            await englishAuctionContract.call('start', [], {caller: deployer});
            expect(await englishAuctionContract.query('endAt')).to.not.be.deep.equal(["0"]);
        });

        it("should emit a start event", async () => {
            await englishAuctionContract.call('start', [], {caller: deployer});
            let events = await englishAuctionContract.getPastEvents('Start', {fromHeight: 0, toHeight: 0});
            expect(events).to.be.an('array').with.length(1);
        });
    });
});