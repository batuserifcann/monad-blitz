import * as dotenv from "dotenv";
dotenv.config();

import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import { defineConfig } from "hardhat/config";

const monadRpc =
  process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const pk = process.env.PRIVATE_KEY;

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    monadTestnet: {
      type: "http",
      chainType: "l1",
      chainId: 10143,
      url: monadRpc,
      accounts: pk !== undefined && pk !== "" ? [pk] : [],
    },
  },
});
