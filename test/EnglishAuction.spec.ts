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
const startingBid = 1;

describe('test NFT', function () {
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
    async function deployEnglishAuction(auctionDuration:number=86400) {
        // compile English Auction contract
        const compiledEnglishAuctionContracts = await vite.compile("EnglishAuction.solpp");
        expect(compiledEnglishAuctionContracts).to.have.property("EnglishAuction");

        // deploy an englishAuction contract
        englishAuctionContract = compiledEnglishAuctionContracts.EnglishAuction;
        englishAuctionContract.setDeployer(seller).setProvider(provider);
        await englishAuctionContract.deploy({ params: [nftContract.address, nftId, startingBid, auctionDuration], responseLatency: 1 });
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
            expect(await nftContract.query("getApproved", [nftId])).to.be.deep.equal([englishAuctionContract.address])
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
            // TODO: better way to test this?
            expect(await englishAuctionContract.query('endAt')).to.not.be.deep.equal(["0"]);
        });

        it("should emit a start event", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('start', [], {caller: seller});
            let events = await englishAuctionContract.getPastEvents('Start', {fromHeight: 0, toHeight: 0});
            expect(events).to.be.an('array').with.length(1);
        });
    });

    describe("bid", () => {
        it("should revert bid if auction has not yet started", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await expect(englishAuctionContract.call('bid', [], {caller: buyer1, amount: "100"})).to.be.rejectedWith("revert");
        });

        // it("should revert bid if auction duration has already passed", async () => {
        // });

        it("should revert if bid amount is lower than current highest bid", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: "200"});
            await englishAuctionContract.call('bid', [], {caller: buyer2, amount: "300"});
            await expect(englishAuctionContract.call('bid', [], {caller: buyer1, amount: "100"})).to.be.rejectedWith("revert");
        })

        it("should update the highest bidder and highest bid amount for successful bid", async () => {
            const englishAuctionContract = await deployEnglishAuction();
            const firstHighestBid = "100";
            const seconddHighestBid = "200";

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: firstHighestBid});
            await englishAuctionContract.call('bid', [], {caller: buyer2, amount: seconddHighestBid});
            expect(await englishAuctionContract.query('highestBid')).to.be.deep.equal([seconddHighestBid]);
            expect(await englishAuctionContract.query('highestBidder')).to.be.deep.equal([buyer2.address]);
        });

        it("should update the refund amount when a bidder's bid is no longer highestBid", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: "230"});
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: "310"});
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: "360"});
            expect(await englishAuctionContract.query('bids', [buyer1.address])).to.be.deep.equal(["540"]);
        });

        it("should emit a bid event", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: "100"});
            let events = await englishAuctionContract.getPastEvents('Bid', {fromHeight: 0, toHeight: 0});
            expect(events).to.be.an('array').with.length(1);
        });
   });

    describe("withdraw", () => {
        // it ("should revert if bidder doesn't have bids that are not highestBidder", async () => {});

        it("should update bidder balance to 0 and transfer amount", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            const firstBid = "100";
            const secondBid = "200";

            // start auction
            await englishAuctionContract.call('start', [], {caller: seller});

            // bid
            const preBidBuyer1Balance = await buyer1.balance();
            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: firstBid});
            await englishAuctionContract.call('bid', [], {caller: buyer2, amount: secondBid});

            // check post-bid, pre-withrdrawal balances
            expect(await englishAuctionContract.query('bids', [buyer1.address], {caller: buyer1})).to.be.deep.equal([firstBid]);
            expect(await englishAuctionContract.balance()).to.be.deep.equal((Number(firstBid) + Number(secondBid)).toString());
            expect(await buyer1.balance()).to.be.deep.equal((BigInt(preBidBuyer1Balance) - BigInt(firstBid)).toString());

            // withdraw bid
            console.log(await buyer1.balance());
            await englishAuctionContract.call('withdraw', [], {caller: buyer1});
            console.log(await buyer1.balance());

            console.log("before final expects");

            // check post-withdrawal balances
            expect(await englishAuctionContract.query('bids', [buyer1.address], {caller: deployer})).to.be.deep.equal(["0"]);
            expect(await englishAuctionContract.balance()).to.be.deep.equal(secondBid);
            expect(await buyer1.balance()).to.be.deep.equal(preBidBuyer1Balance);
        });

        it("should emit a withdraw event", async () => {
            const englishAuctionContract = await deployEnglishAuction();

            await englishAuctionContract.call('withdraw', [], {caller: deployer});
            let events = await englishAuctionContract.getPastEvents('Withdraw', {fromHeight: 0, toHeight: 0});
            expect(events).to.be.an('array').with.length(1);
        });
    });

    // TODO: deploy englishAuction contract with auctionDuration = 1s
    describe("end", () => {
        it("should revert if auction has not yet started", async () => {
            const englishAuctionContract = await deployEnglishAuction(1)

            // TODO: assertion fails even though output is as expected with "Error: revert"
            await expect(englishAuctionContract.call('end', [], {caller: somebody})).to.eventually.be.rejectedWith("revert");
        });

        it("should revert if auction duration has not yet passed", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            await englishAuctionContract.call('start', [], {caller: seller});
            // TODO: need to ensure custom auctionDuration (1 second)
            await new Promise(r => setTimeout(r, 2000));
            // TODO: verify end() doesn't revert in end tests
            await englishAuctionContract.call('end', [], {caller: somebody});
            // TODO: assertion fails even though output is as expected with "Error: revert"
            await expect(englishAuctionContract.call('end', [], {caller: somebody})).to.eventually.be.rejectedWith("revert");
        });

        it("should revert if auction has already ended", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            await englishAuctionContract.call('start', [], {caller: seller});
            // TODO: need to set custom auctionDuration (1 second)
            await new Promise(r => setTimeout(r, 2000));
            await englishAuctionContract.call('end', [], {caller: somebody});
            // TODO: assertion fails even though output is as expected with "Error: revert"
            await expect(englishAuctionContract.call('end', [], {caller: somebody})).to.eventually.be.rejectedWith("revert");
        });

        it("should update auction ended to true", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('end', [], {caller: somebody});
            expect(await englishAuctionContract.query('ended', [], {caller: somebody})).to.be.deep.equal(["1"]);
        });

        it("should transfer NFT to highestBidder and transfer highestBid to seller", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([seller.address]);

            await englishAuctionContract.call('start', [], {caller: seller});
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([englishAuctionContract.address]);

            await englishAuctionContract.call('bid', [], {caller: buyer1, amount: "200"});
            await englishAuctionContract.call('bid', [], {caller: buyer2, amount: "300"});
            // check balances
            // expect( await englishAuctionContract.balance())
            // expect(await buyer1.balance())
            // expect(await buyer2.balance())

            await englishAuctionContract.call('end', [], {caller: somebody});
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([buyer2.address]);
            // check balances
            // expect(await englishAuctionContract.balance())
            // expect(await buyer1.balance())

        });

        it("should transfer NFT back to seller if no bids", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([seller.address]);

            await englishAuctionContract.call('start', [], {caller: seller});
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([englishAuctionContract.address]);

            await englishAuctionContract.call('end', [], {caller: somebody});
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([seller.address]);
        });

        it("should emit an End event", async () => {
            const englishAuctionContract = await deployEnglishAuction(1);

            await englishAuctionContract.call('start', [], {caller: seller});
            await englishAuctionContract.call('end', [], {caller: somebody});
            let events = await englishAuctionContract.getPastEvents('End', {fromHeight: 0, toHeight: 0});
            expect(events).to.be.an('array').with.length(1);
        });
    });
});