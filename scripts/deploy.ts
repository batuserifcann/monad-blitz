import { network } from "hardhat";

// Uses the selected CLI network (`--network monadTestnet`) or the default EDR network for local runs.
const { ethers } = await network.connect();

const signers = await ethers.getSigners();
if (signers.length === 0) {
  throw new Error(
    "No deployer account: for monadTestnet set PRIVATE_KEY in .env (see .env.example).",
  );
}
const deployer = signers[0]!;

const factory = await ethers.getContractFactory("TankBlitz");
const tankBlitz = await factory.deploy(deployer.address);

await tankBlitz.waitForDeployment();

const address = await tankBlitz.getAddress();
console.log("TankBlitz deployed to:", address);
console.log("Server address (deployer):", deployer.address);
