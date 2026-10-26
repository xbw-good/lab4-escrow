import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const AMOUNT = ethers.parseUnits("30", 18);

async function deployFixture() {
  const [deployer, buyer, seller, arbiter, stranger] = await ethers.getSigners();
  // 注意：这里换成了你的代币合约名 XBWToken
  const token = await ethers.deployContract("XBWToken");
  
  // deployer 是代币的 owner，给买家 mint 100 个代币
  await token.mint(buyer.address, ethers.parseUnits("100", 18)); 
  
  const escrow = await ethers.deployContract("Escrow", [arbiter.address]);
  const deadline = (await time.latest()) + 3600;
  
  return { token, escrow, deployer, buyer, seller, arbiter, stranger, deadline };
}

describe("Escrow", function () {
  it("createOrder 记录订单并发出事件", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    await expect(
      escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书")
    )
      .to.emit(escrow, "OrderCreated")
      .withArgs(0, buyer.address, seller.address, await token.getAddress(), AMOUNT, deadline);
      
    const order = await escrow.getOrder(0);
    expect(order.buyer).to.equal(buyer.address);
    expect(order.status).to.equal(0); // Created
    expect(await escrow.orderCount()).to.equal(1);
  });

  it("未 approve 时 deposit 失败", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    // 报错文字换成了你代币合约里对应的 require 报错
    await expect(escrow.connect(buyer).deposit(0)).to.be.revertedWith("XBWToken: transfer amount exceeds allowance");
  });

  // TODO: 补齐下面 6 个用例

  it("approve 后 deposit 成功，代币进入 Escrow，状态变为 Paid", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    
    // 买家先给 Escrow 合约授权
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    
    // 买家付款
    await expect(escrow.connect(buyer).deposit(0)).to.emit(escrow, "OrderPaid").withArgs(0);
    
    // 验证合约收到了代币
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(AMOUNT);
    // 验证订单状态变成了 Paid (1)
    const order = await escrow.getOrder(0);
    expect(order.status).to.equal(1); 
  });

  it("非买家调用 confirm 失败", async function () {
    const { token, escrow, buyer, seller, stranger, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);

    // 陌生人（非买家）尝试确认收货，应该被 onlyBuyer 修饰器拦截
    await expect(escrow.connect(stranger).confirm(0)).to.be.revertedWith("Escrow: caller is not the buyer");
  });

  it("confirm 后卖家收到代币，状态变为 Completed", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);

    // 记录卖家之前的余额
    const sellerBalanceBefore = await token.balanceOf(seller.address);
    
    // 买家确认收货
    await expect(escrow.connect(buyer).confirm(0)).to.emit(escrow, "OrderCompleted").withArgs(0);
    
    // 验证卖家收到了代币，且状态变为 Completed (2)
    expect(await token.balanceOf(seller.address)).to.equal(sellerBalanceBefore + AMOUNT);
    const order = await escrow.getOrder(0);
    expect(order.status).to.equal(2);
  });

  it("deadline 之前 refund 失败，deadline 之后 refund 成功并退回买家", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);

    // 1. 时间还没到，尝试退款应该失败
    await expect(escrow.connect(buyer).refund(0)).to.be.revertedWith("Escrow: deadline not reached");

    // 2. 快进时间到 deadline 之后
    await time.increaseTo(deadline + 100);

    const buyerBalanceBefore = await token.balanceOf(buyer.address);

    // 3. 再次退款，成功
    await expect(escrow.connect(buyer).refund(0)).to.emit(escrow, "OrderRefunded").withArgs(0);
    
    // 验证买家收回了代币，状态变为 Refunded (3)
    expect(await token.balanceOf(buyer.address)).to.equal(buyerBalanceBefore + AMOUNT);
    const order = await escrow.getOrder(0);
    expect(order.status).to.equal(3);
  });

  it("非仲裁人调用 resolve 失败", async function () {
    const { token, escrow, buyer, seller, stranger, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);
    await escrow.connect(buyer).dispute(0);

    // 陌生人尝试仲裁，应该被 onlyArbiter 拦截
    await expect(escrow.connect(stranger).resolve(0, true)).to.be.revertedWith("Escrow: caller is not the arbiter");
  });

  it("dispute 后仲裁人 resolve(false) 退款给买家，状态变为 Refunded", async function () {
    const { token, escrow, buyer, seller, arbiter, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);
    
    // 买家发起争议
    await escrow.connect(buyer).dispute(0);

    const buyerBalanceBefore = await token.balanceOf(buyer.address);

    // 仲裁人介入，判定卖家输 (sellerWins = false)
    await expect(escrow.connect(arbiter).resolve(0, false)).to.emit(escrow, "OrderResolved").withArgs(0, false);
    
    // 验证代币退给了买家，状态变为 Refunded (3)
    expect(await token.balanceOf(buyer.address)).to.equal(buyerBalanceBefore + AMOUNT);
    const order = await escrow.getOrder(0);
    expect(order.status).to.equal(3); 
  });
});