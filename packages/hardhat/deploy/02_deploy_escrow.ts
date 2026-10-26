import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
const ARBITER = "0x8f56f25BB6755c1cE4F0935a64162a96e2a7C8BF";
const deployEscrow: DeployFunction = async function (hre:
HardhatRuntimeEnvironment) {
const { deployer } = await hre.getNamedAccounts();
await hre.deployments.deploy("Escrow", { from: deployer, args: [ARBITER], log: true,
autoMine: true });
};
export default deployEscrow;
deployEscrow.tags = ["EscrowLYH202430550926"];