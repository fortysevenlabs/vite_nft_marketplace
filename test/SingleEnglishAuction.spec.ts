import { describe } from "mocha";
import { expect, use } from "chai";
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

const vite = require('@vite/vuilder');
import config from "./vite.config.json";
import { getEnabledCategories } from "trace_events";
import { deflateSync } from "zlib";

let provider: any;
let deployer: any;

// contracts
let nftContract: any;
let englishAuctionContract: any;

// user accounts
let seller: any;
let buyer1: any;
let buyer2: any;
let somebody: any;

// NFT details
const name = 'Vite Testing Token';
const symbol = 'VITE';
const nftId = 1010;

describe('test EnglishAuction', function () {
before(async function () {
// provider and account setup
provider = vite.newProvider(config.networks.local.http);
deployer = vite.newAccount(config.networks.local.mnemonic, 0, provider);
console.log("------> deployer", deployer.address);
console.log(await deployer.balance());

        // user setup
        seller = vite.newAccount(config.networks.local.mnemonic, 1, provider);
        console.log("------> seller", seller.address);
        await deployer.sendToken(seller.address, '1000000000000000000000000');
        await seller.receiveAll();
        console.log(await deployer.balance());
        console.log(await seller.balance());

        buyer1 = vite.newAccount(config.networks.local.mnemonic, 2, provider);
        console.log("------> buyer1", buyer1.address);
        await deployer.sendToken(buyer1.address, '1000000000000000000000000');
        await buyer1.receiveAll();
        console.log(await deployer.balance());
        console.log(await buyer1.balance());

        buyer2 = vite.newAccount(config.networks.local.mnemonic, 3, provider);
        console.log("------> buyer2", buyer2.address);
        await deployer.sendToken(buyer2.address, '1000000000000000000000000');
        await buyer2.receiveAll();

        somebody = vite.newAccount(config.networks.local.mnemonic, 4, provider);
        console.log("------> somebody", somebody.address);
        await deployer.sendToken(somebody.address, '1000000000000000000000000');
        await somebody.receiveAll();


        // compile NFT contract
        const compiledNFTContracts = await vite.compile("NFT.solpp");
        expect(compiledNFTContracts).to.have.property("NFT");

        // deploy an NFT contract
        nftContract = compiledNFTContracts.NFT;
        nftContract.setDeployer(seller).setProvider(provider);
        await nftContract.deploy({params: [name, symbol], responseLatency: 1});
        expect(nftContract.address).to.be.a("string");
        console.log("------> NFT Contract", nftContract.address);

        // mint
        await nftContract.call('mint', [seller.address, nftId], {});
    });

    // compile english contract
    // using a function instead of beforeEach so that we can pass custom params to constructor
    // note that mocha treats test failures and hook failures differently
    async function deployEnglishAuction(duration:number=86400, reservePrice:number=1, minBidIncrementPercentage:number=50) {
        // compile English Auction contract
        const compiledEnglishAuctionContracts = await vite.compile("SingleEnglishAuction.solpp");
        expect(compiledEnglishAuctionContracts).to.have.property("SingleEnglishAuction");

        // deploy an englishAuction contract
        englishAuctionContract = compiledEnglishAuctionContracts.SingleEnglishAuction;
        englishAuctionContract.setDeployer(seller).setProvider(provider);
        await englishAuctionContract.deploy({ params: [nftContract.address, nftId, reservePrice, minBidIncrementPercentage, duration], responseLatency: 1 });
        expect(englishAuctionContract.address).to.be.a("string");
        console.log("------> English Auction Contract", englishAuctionContract.address);

        return englishAuctionContract;
    }

describe("start", () => {

        it("should revert if auction is not started by seller", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await expect(englishAuctionContract.call('start', [], {caller: somebody})).to.eventually.be.rejectedWith("revert");
        })

        it("should revert if auction has already started", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('start', [], {caller: seller});
            await expect(englishAuctionContract.call('start', [], {caller: seller})).to.eventually.be.rejectedWith("revert");
        });

        it("should transfer NFT from seller to contract", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            // approve englishAuctionContract to call transferFrom
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([seller.address])
            await nftContract.call('approve', [englishAuctionContract.address, nftId], {caller: seller});
            expect(await nftContract.query("getApproved", [nftId])).to.be.deep.equal([englishAuctionContract.address]);
            console.log(await nftContract.query('ownerOf', [nftId]));
            console.log(await nftContract.query('getApproved', [nftId]));

            // TODO: FIX this, englishAuctionContract.start isn't transferring.
            await englishAuctionContract.call('start', [], {caller: seller});

            console.log(await nftContract.query('ownerOf', [nftId]));
            expect(await nftContract.query('ownerOf', [nftId])).to.be.deep.equal([englishAuctionContract.address]);
        });

        it("should update auction started to true", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('start', [], {caller: seller});
            expect(await englishAuctionContract.query('started')).to.be.deep.equal(['1']);
        });

        it("should set auction end time accurately", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('start', [], {caller: seller});
            // TODO: better way to test this since we can't log block.timestamp during start call?
            expect(await englishAuctionContract.query('endTime')).to.not.be.deep.equal(["0"]);
        });

        it("should emit a AuctionStarted event", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('start', [], {caller: seller});
            let events = await englishAuctionContract.getPastEvents('AuctionStarted', {fromHeight: 0, toHeight: 0});
            expect(events).to.be.an('array').with.length(1);
        });
    });

    describe("bid", () => {
        it("should revert bid if auction has not started", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await expect(englishAuctionContract.call('bid', [], {caller: buyer1, amount: "100"})).to.be.rejectedWith("revert");
        });

        it("should revert bid if auction has ended", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            await englishAuctionContract.call('start', [], {caller: seller});
            await new Promise(r => setTimeout(r, 2000));
            await expect(englishAuctionContract.call('bid', [], {caller: buyer1, amount: "100"})).to.be.rejectedWith("revert");
        });

        it("should revert if bid amount is lower than current highestBid by minBidIncrementPercentage", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: "200"});
            await expect(englishAuctionContract.call('bid', [], {caller: buyer1, amount: "250"})).to.be.rejectedWith("revert");     // minBidIncrementPercentage default is 50%
        })

        it("should update the highest bidder and highest bid amount for successful bid", async () => {
            const englishAuctionContract = await deployEnglishAuction();
            const firstHighestBid = "100";
            const secondHighestBid = "200";

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: firstHighestBid});
            await englishAuctionContract.call('bid', [], {caller: buyer2, amount: secondHighestBid});
            expect(await englishAuctionContract.query('highestBid')).to.be.deep.equal([secondHighestBid]);
            expect(await englishAuctionContract.query('highestBidder')).to.be.deep.equal([buyer2.address]);
        });

        it("should refund the prevHighestBidder when a new highestBid is made", async () => {
            const englishAuctionContract = await deployEnglishAuction();
            const firstHighestBid = "100";
            const secondHighestBid = "200";

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: firstHighestBid});
            expect(await englishAuctionContract.balance()).to.be.deep.equal(firstHighestBid);
            await englishAuctionContract.call('bid', [], {caller: buyer2, amount: secondHighestBid});
            expect(await englishAuctionContract.balance()).to.be.deep.equal(secondHighestBid);
            // TODO FIX: transfers fail - debit from contract works, credit to buyer1 fails
            expect(await buyer1.balance()).to.be.deep.equal('1000000000000000000000000');
            expect(await buyer2.balance()).to.be.deep.equal('999999999999999999999800');
        });

        it("should emit a AuctionBid event", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: "100"});
            let events = await englishAuctionContract.getPastEvents('AuctionBid', {fromHeight: 0, toHeight: 0});
            expect(events).to.be.an('array').with.length(1);
        });

});

    describe("settle", () => {
        it("should revert if auction has not started", async () => {
            const englishAuctionContract = await deployEnglishAuction(1)

            await expect(englishAuctionContract.call('settle', [], {caller: somebody})).to.eventually.be.rejectedWith("revert");
        });

        it("should revert if auction has not ended", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            await englishAuctionContract.call('start', [], {caller: seller});
            await new Promise(r => setTimeout(r, 2000));
            await englishAuctionContract.call('settle', [], {caller: somebody});
            await expect(englishAuctionContract.call('settle', [], {caller: somebody})).to.eventually.be.rejectedWith("revert");
        });

        it("should revert if auction has already settled", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            await englishAuctionContract.call('start', [], {caller: seller});
            await new Promise(r => setTimeout(r, 2000));
            await englishAuctionContract.call('settle', [], {caller: somebody});
            await expect(englishAuctionContract.call('settle', [], {caller: somebody})).to.eventually.be.rejectedWith("revert");
        });

        it("should update auction settled to true", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('settle', [], {caller: somebody});
            expect(await englishAuctionContract.query('settled', [], {caller: somebody})).to.be.deep.equal(["1"]);
        });

        it("should transfer NFT to highestBidder and transfer highestBid to seller", async () => {
            const englishAuctionContract = await deployEnglishAuction(5);
            const firstHighestBid = "100";
            const secondHighestBid = "200";

            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([seller.address]);

            await englishAuctionContract.call('start', [], {caller: seller});
            // TODO FIX: transfer fails
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([englishAuctionContract.address]);

            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: firstHighestBid});
            expect(await englishAuctionContract.balance()).to.be.deep.equal(firstHighestBid);
            expect(await buyer1.balance()).to.be.deep.equal('999999999999999999999900');
            expect(await seller.balance()).to.be.deep.equal('TBD');

            await englishAuctionContract.call('bid', [], {caller: buyer2, amount: secondHighestBid});
            expect(await englishAuctionContract.balance()).to.be.deep.equal(secondHighestBid);
            expect(await buyer1.balance()).to.be.deep.equal('1000000000000000000000000');
            expect(await buyer2.balance()).to.be.deep.equal('999999999999999999999800');
            expect(await seller.balance()).to.be.deep.equal('TBD');

            // wait for auction to end and then call settle
            await new Promise(r => setTimeout(r, 5000));
            await englishAuctionContract.call('settle', [], {caller: somebody});

            // TODO FIX: transfer fails
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([buyer2.address]);
            // TODO FIX: transfer fails - debit from contract works, credit to buyer1 fails
            expect(await buyer1.balance()).to.be.deep.equal('1000000000000000000000000');
            expect(await buyer2.balance()).to.be.deep.equal('999999999999999999999800');
            expect(await seller.balance()).to.be.deep.equal('TBD');
            expect(await englishAuctionContract.balance()).to.be.deep.equal('0');

        });

        it("should transfer NFT back to seller if no bids", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([seller.address]);

            await englishAuctionContract.call('start', [], {caller: seller});
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([englishAuctionContract.address]);

            // TODO: settle involves a transfer, fails
            await englishAuctionContract.call('settle', [], {caller: somebody});
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([seller.address]);
        });

        it("should emit an AuctionSettled event", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('settle', [], {caller: somebody});
            let events = await englishAuctionContract.getPastEvents('AuctionSettled', {fromHeight: 0, toHeight: 0});
            expect(events).to.be.an('array').with.length(1);
        });
    });

});
