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
const auctionDuration = 1;

describe('test NFT', function () {
    before(async function () {
        // provider and account setup
        provider = vite.newProvider(config.networks.local.http);
        deployer = vite.newAccount(config.networks.local.mnemonic, 0, provider);
        console.log("------> deployer", deployer.address);

        // user setup
        seller = vite.newAccount(config.networks.local.mnemonic, 1, provider);
        await deployer.sendToken(seller.address, '0');
        await seller.receiveAll();
        console.log("------> seller", seller.address);
        buyer1 = vite.newAccount(config.networks.local.mnemonic, 2, provider);
        await deployer.sendToken(buyer1.address, '0');
        await buyer1.receiveAll();
        console.log("------> buyer1", buyer1.address);
        buyer2 = vite.newAccount(config.networks.local.mnemonic, 3, provider);
        await deployer.sendToken(buyer2.address, '0');
        await buyer2.receiveAll();
        console.log("------> buyer2", buyer2.address);
        somebody = vite.newAccount(config.networks.local.mnemonic, 4, provider);
        await deployer.sendToken(somebody.address, '0');
        await somebody.receiveAll();
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
        await englishAuctionContract.deploy({ params: [nftContract.address, nftId, startingBid, auctionDuration], responseLatency: 1 });
        expect(englishAuctionContract.address).to.be.a("string");
        console.log("------> English Auction Contract", englishAuctionContract.address);
    });

//    describe("start", () => {
//         it("should revert if auction is not started by seller", async () => {
//             // TODO: results in "abort([object Object])" instead of "revert"
//             await expect(englishAuctionContract.call('start', [], {caller: somebody})).to.eventually.be.rejectedWith("revert");
//         })

//         it("should revert if auction has already started", async () => {
//             await englishAuctionContract.call('start', [], {});
//             await expect(englishAuctionContract.call('start', [], {})).to.eventually.be.rejectedWith("revert");
//         });

//         it("should transfer NFT from seller to contract", async () => {
//             // approve englishAuction to call transferFrom
//             expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([deployer.address])
//             await nftContract.call('approve', [englishAuctionContract.address, nftId], {caller: deployer});
//             expect(await nftContract.query("getApproved", [nftId])).to.be.deep.equal([englishAuctionContract.address])

//             // TODO: FIX this, englishAuctionContract.call isn't transferring.
//             await nftContract.call('transferFrom', [deployer.address, englishAuctionContract.address, nftId], {caller: deployer});
//             // await englishAuctionContract.call('start', [], {caller: deployer});

//             expect(await nftContract.query('ownerOf', [nftId])).to.be.deep.equal([englishAuctionContract.address]);
//         });

//         it("should update auction started to true", async () => {
//             await englishAuctionContract.call('start', [], {caller: deployer});
//             expect(await englishAuctionContract.query('started')).to.be.deep.equal(['1']);
//         });

//         it("should set auction end time accurately", async () => {
//             // TODO: better way to test this?
//             await englishAuctionContract.call('start', [], {caller: deployer});
//             expect(await englishAuctionContract.query('endAt')).to.not.be.deep.equal(["0"]);
//         });

//         it("should emit a start event", async () => {
//             await englishAuctionContract.call('start', [], {caller: deployer});
//             let events = await englishAuctionContract.getPastEvents('Start', {fromHeight: 0, toHeight: 0});
//             expect(events).to.be.an('array').with.length(1);
//         });
//     });

//     describe("bid", () => {
//         it("should revert bid if auction has not yet started", async () => {
//             // TODO: assertion fails even though output is as expected with "Error: revert"
//             expect(await englishAuctionContract.call('bid', [], {caller: deployer})).to.eventually.be.rejectedWith("revert");
//         });

//         it("should revert bid if auction duration has already passed", async () => {
//         });

//         it("should revert if bid amount is lower than current highest bid", async () => {
//             await englishAuctionContract.call('start', [], {caller: deployer});
//             await englishAuctionContract.call('bid', [], {caller: deployer, amount: "200"});
//             await englishAuctionContract.call('bid', [], {caller: deployer, amount: "300"});
//            // TODO: assertion fails even though output is as expected with "Error: revert"
//             expect(await englishAuctionContract.call('bid', [], {caller: deployer, amount: "100"})).to.eventually.be.rejectedWith("revert");
//         });

//         it("should update the highest bidder and highest bid amount for successful bid", async () => {
//             const firstHighestBid = "100";
//             const seconddHighestBid = "100";
//             await englishAuctionContract.call('start', [], {caller: deployer});
//             await englishAuctionContract.call('bid', [], {caller: deployer, amount: firstHighestBid});
//             await englishAuctionContract.call('bid', [], {caller: deployer, amount: seconddHighestBid});
//             expect(await englishAuctionContract.query('highestBid')).to.be.deep.equal([seconddHighestBid]);
//             expect(await englishAuctionContract.query('highestBidder')).to.be.deep.equal([deployer.address]);
//         });

//         it("should update bids value for multiple bids from a buyer", async () => {
//             await englishAuctionContract.call('start', [], {caller: deployer});
//             await englishAuctionContract.call('bid', [], {caller: deployer, amount: "230"});
//             await englishAuctionContract.call('bid', [], {caller: deployer, amount: "310"});
//             // TODO: fails, tried both chai assertion and chai-as-promise assertion
//             // chai assertion: the "bids[deployer.address]" doesn't update until some time (result = 230 instead of 540) likely related to vuilder bug
//             expect(await englishAuctionContract.query('bids', [deployer.address], {caller: deployer})).to.be.deep.equal(["540"]);
//             // chai-as-promise assertion: query is not promise so this test doesn't work
//             expect(await englishAuctionContract.query('bids', [deployer.address], {caller: deployer})).to.eventually.be.equal(["540"]);
//         });

//         it("should emit a bid event", async () => {
//             await englishAuctionContract.call('start', [], {caller: deployer});
//             await englishAuctionContract.call('bid', [], {caller: deployer, amount: "100"});
//             let events = await englishAuctionContract.getPastEvents('Bid', {fromHeight: 0, toHeight: 0});
//             expect(events).to.be.an('array').with.length(1);
//         });
//    });

    // describe("withdraw", () => {
    //     it("should update bidder balance to 0 and transfer amount", async () => {
    //         const bidAmount: any = "100";
    //         const initialBidderBalance = await deployer.balance();

    //         // start auction
    //         await englishAuctionContract.call('start', [], {caller: deployer});

    //         // bid
    //         await englishAuctionContract.call('bid', [], {caller: deployer, amount: bidAmount});
    //         const postBidBidderBalance = await deployer.balance();
    //         expect(await englishAuctionContract.balance()).to.be.deep.equal(bidAmount);

    //         // withdraw bid
    //         await englishAuctionContract.call('withdraw', [], {caller: deployer});
    //         const postWithdrawBidderBalance = await deployer.balance();

    //         // TODO: fails, does the solpp transfer and transferFrom not work?
    //         expect(await englishAuctionContract.balance()).to.be.deep.equal("0");
    //         // TODO: ugly line, also fails, need to convert comparison amount from sci notiation to string (big int)
    //         expect(await deployer.balance()).to.be.deep.equal(postBidBidderBalance - bidAmount);
    //         expect(await englishAuctionContract.query('bids', [deployer.address], {caller: deployer})).to.be.deep.equal(["0"]);
    //     });

    //     it("should emit a withdraw event", async () => {
    //         await englishAuctionContract.call('withdraw', [], {caller: deployer});
    //         let events = await englishAuctionContract.getPastEvents('Withdraw', {fromHeight: 0, toHeight: 0});
    //         expect(events).to.be.an('array').with.length(1);
    //     });
    // });

    describe("end", () => {
        deploy englishAuction contract auctionDuration = 1s

        it("should revert if auction has not yet started", async () => {
            // TODO: assertion fails even though output is as expected with "Error: revert"
            expect(await englishAuctionContract.call('end', [], {caller: deployer})).to.eventually.be.rejectedWith("revert");
        });

        it("should revert if auction duration has not yet passed", async () => {
            await englishAuctionContract.call('start', [], {caller: deployer});
            // TODO: need to ensure custom auctionDuration (1 second)
            await new Promise(r => setTimeout(r, 2000));
            // TODO: verify end() doesn't revert in end tests
            await englishAuctionContract.call('end', [], {caller: deployer});
            // TODO: assertion fails even though output is as expected with "Error: revert"
            expect(await englishAuctionContract.call('end', [], {caller: deployer})).to.eventually.be.rejectedWith("revert");
        });

        it("should revert if auction has already ended", async () => {
            await englishAuctionContract.call('start', [], {caller: deployer});
            // TODO: need to set custom auctionDuration (1 second)
            // TODO: assertion fails even though output is as expected with "Error: revert"
            expect(await englishAuctionContract.call('end', [], {caller: deployer})).to.eventually.be.rejectedWith("revert");
        });

        it("should update auction ended to true", async () => {
            await englishAuctionContract.call('start', [], {caller: deployer});
            await englishAuctionContract.call('end', [], {caller: deployer});
            expect(await englishAuctionContract.query('ended', [], {caller: deployer})).to.be.deep.equal(["1"]);
        // });

        it("should transfer NFT to highestBidder and transfer highestBid to seller", async () => {
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([deployer.address]);

            await englishAuctionContract.call('start', [], {caller: deployer});
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([englishAuctionContract.address]);

            await englishAuctionContract.call('bid', [], {caller: deployer, amount: "200"});
            await englishAuctionContract.call('bid', [], {caller: deployer, amount: "300"});
            // check balances
            // expect( await englishAuctionContract.balance())
            // expect(await buyer1.balance())
            // expect(await buyer2.balance())

            await englishAuctionContract.call('end', [], {caller: deployer});
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([deployer.address]);
            // check balances
            // expect(await englishAuctionContract.balance())
            // expect(await buyer1.balance())

        });

        it("should return nft back to seller if no bids", async () => {
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([deployer.address]);

            await englishAuctionContract.call('start', [], {caller: deployer});
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([englishAuctionContract.address]);

            await englishAuctionContract.call('end', [], {caller: deployer});
            expect(await nftContract.query("ownerOf", [nftId])).to.be.deep.equal([deployer.address]);
        });

        it("should emit an End event", async () => {
            await englishAuctionContract.call('start', [], {caller: deployer});
            await englishAuctionContract.call('end', [], {caller: deployer});
            let events = await englishAuctionContract.getPastEvents('End', {fromHeight: 0, toHeight: 0});
            expect(events).to.be.an('array').with.length(1);
        });
    });
});