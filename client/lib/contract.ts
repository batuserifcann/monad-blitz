"use client";

import { BrowserProvider, Contract, ethers, formatEther, getAddress } from "ethers";

const MONAD_CHAIN_ID = BigInt(10143);
const MONAD_HEX = "0x279F";

const TANK_BLITZ_ABI = [
  "function registerPlayer(uint256 gameId, uint256 ammoCount) payable",
  "function getGameInfo(uint256 gameId) view returns (uint8 status, uint256 playerCount, uint256 prizePool)",
  "function getPlayer(uint256 gameId, address player) view returns (uint256 monBalance, uint16 hp, uint16 ammo, uint16 attackPower, bool joined)",
  "function getPlayerList(uint256 gameId) view returns (address[] memory)",
] as const;

function getContractAddress(): string {
  const a = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!a) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set");
  return a;
}

function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
}

export function getEthereum(): import("ethers").Eip1193Provider {
  if (typeof window === "undefined") {
    throw new Error("Wallet is only available in the browser");
  }
  const eth = (window as unknown as { ethereum?: import("ethers").Eip1193Provider })
    .ethereum;
  if (!eth) {
    throw new Error("MetaMask not found");
  }
  return eth;
}

export async function getChainId(): Promise<bigint> {
  const eth = getEthereum();
  const id = await eth.request({ method: "eth_chainId" });
  return BigInt(id as string);
}

export async function ensureMonadTestnet(): Promise<void> {
  const eth = getEthereum();
  const current = await getChainId();
  if (current === MONAD_CHAIN_ID) return;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_HEX }],
    });
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? (e as { code?: number }).code
        : undefined;
    if (code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: MONAD_HEX,
            chainName: "Monad Testnet",
            nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
            rpcUrls: [getRpcUrl()],
            blockExplorerUrls: ["https://testnet-explorer.monad.xyz"],
          },
        ],
      });
      return;
    }
    throw e;
  }
}

export async function connectWallet(): Promise<string> {
  await ensureMonadTestnet();
  const eth = getEthereum();
  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const addr = await signer.getAddress();
  return getAddress(addr);
}

export async function getMonBalance(address: string): Promise<string> {
  await ensureMonadTestnet();
  const provider = new BrowserProvider(getEthereum());
  const bal = await provider.getBalance(address);
  return formatEther(bal);
}

export function getTankBlitzContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  return new Contract(getContractAddress(), TANK_BLITZ_ABI, signerOrProvider);
}

const WEI_PER_BULLET = ethers.parseEther("0.01");

export async function registerPlayer(
  gameId: bigint,
  ammoCount: number
): Promise<ethers.TransactionResponse> {
  await ensureMonadTestnet();
  const provider = new BrowserProvider(getEthereum());
  const signer = await provider.getSigner();
  const c = getTankBlitzContract(signer);
  const value = WEI_PER_BULLET * BigInt(ammoCount);
  return c.registerPlayer(gameId, ammoCount, { value }) as Promise<
    ethers.TransactionResponse
  >;
}

export async function readGameInfo(gameId: bigint) {
  const provider = new BrowserProvider(getEthereum());
  const c = getTankBlitzContract(provider);
  const r = await c.getGameInfo(gameId);
  return {
    status: Number(r[0]),
    playerCount: r[1] as bigint,
    prizePool: r[2] as bigint,
  };
}

export async function readPlayer(gameId: bigint, player: string) {
  const provider = new BrowserProvider(getEthereum());
  const c = getTankBlitzContract(provider);
  const r = await c.getPlayer(gameId, player);
  return {
    monBalance: r[0] as bigint,
    hp: Number(r[1]),
    ammo: Number(r[2]),
    attackPower: Number(r[3]),
    joined: r[4] as boolean,
  };
}

export async function readPlayerList(gameId: bigint): Promise<string[]> {
  const provider = new BrowserProvider(getEthereum());
  const c = getTankBlitzContract(provider);
  const list = await c.getPlayerList(gameId);
  return [...list] as string[];
}
