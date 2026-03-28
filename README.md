# 🎯 Tank Blitz — On-Chain Multiplayer Tank Battle on Monad

> **Stake MON. Fight. Earn. All on-chain.**

Tank Blitz is a real-time multiplayer tank battle game where every bullet costs real MON, every kill triggers an instant on-chain transfer, and the last tank standing wins 95% of the prize pool. Built on Monad's parallel EVM to showcase what true on-chain gaming looks like.

🔗 **Live Demo:** [monad-blitz-eta.vercel.app](https://monad-blitz-eta.vercel.app)

---

## How It Works

Players connect their MetaMask wallet, choose how many bullets they want (10–50, each costing 0.01 MON), and enter the arena. Movement is WASD, aiming is mouse, shooting is click. Every hit increases your attack power while every miss decreases it — accuracy is literally money.

When you eliminate an opponent, their entire remaining MON balance is instantly transferred to your wallet via smart contract, confirmed on-chain in under 1 second. The last tank standing takes 95% of the total prize pool, with 5% going to the protocol.

A live transaction feed runs alongside the game, showing every blockchain interaction in real-time — game creation, battle start, kills, and final payouts — all verifiable on Monad Explorer.

---

## Why Monad?

Real-time multiplayer games with on-chain economic transactions need speed and near-zero gas. On Ethereum, a single kill confirmation takes 15 seconds and costs significant gas. On Monad, it confirms in under 1 second with negligible fees. Tank Blitz is a live stress test of Monad's 10K TPS — multiple players battling simultaneously, each action reflected on-chain almost instantly.

---

## Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│  Frontend          Next.js 16 + Phaser.js + ethers v6   │
│  Game Server       Node.js + Socket.io (30 tick/sec)    │
│  Smart Contract    Solidity 0.8.20 on Monad Testnet     │
│  Deploy            Vercel (client) + Render (server)    │
│  AI Commentary     Claude API (Anthropic)               │
└─────────────────────────────────────────────────────────┘
```

---

## Features

**Core Gameplay**

- 2D top-down tank arena (800×600)
- WASD movement, mouse aim, click to shoot
- Variable stake entry: 10–50 bullets (0.1–0.5 MON)
- Skill-based attack power: hits increase damage, misses decrease it
- Kill = steal all of victim's remaining MON

**On-Chain Economy**

- Every player registration is an on-chain transaction
- Every kill triggers an instant on-chain MON transfer
- Game end settles the prize pool: 95% winner / 5% protocol
- On-chain leaderboard tracking wins, kills, and total earnings

**Live Blockchain Feed**

- Real-time transaction feed during gameplay
- Shows game creation, battle start, kills, payouts
- Clickable links to Monad Explorer for verification

**AI Commentary**

- Claude-powered esports commentator
- Generates dramatic one-liners on kills and game endings
- Adds entertainment value and showcases AI + blockchain integration

**Visual Polish**

- Custom tank visuals with turret, tracks, and glow effects
- Bullet trail effects matching shooter's color
- HP bars on all tanks with color-coded health status
- Sound effects: shoot, hit, explosion, victory jingle
- Win: confetti particles / Lose: screen shake + red flash
- Kill feed with skull emojis and MON transfer amounts

---

## Smart Contract

**Address (Monad Testnet):** `0x008272d6f2FB804e041d20BA8ceE0040A9afa6e8`

```solidity
// Key functions
registerPlayer(gameId, ammoCount)  // Stake MON as ammo (0.01 MON/bullet)
startGame(gameId)                  // Server starts the battle
recordKill(gameId, killer, victim) // Transfer victim's MON to killer
endGame(gameId, winner)            // 95% to winner, 5% protocol
getPlayerStats(address)            // On-chain leaderboard stats
```

---

## Architecture

```
┌──────────┐    Socket.io     ┌──────────────┐    ethers.js    ┌─────────────┐
│  Client   │◄──────────────►│  Game Server  │◄──────────────►│   Monad     │
│  Next.js  │  game-state     │  Node.js      │  tx queue      │   Testnet   │
│  Phaser   │  player-input   │  30 tick/sec  │  kill/endgame  │   10143     │
└──────────┘                  └──────────────┘                 └─────────────┘
     │                                                               │
     │  MetaMask                                                     │
     └──────────── registerPlayer (0.01 MON × ammo) ───────────────►│
```

**Game Loop:** The server is the authority. Clients send inputs (keys + aim angle), the server simulates physics, detects collisions, applies damage, and broadcasts the full game state 30 times per second. Blockchain calls happen only on significant events (kill, game end) to keep gameplay smooth.

---

## Running Locally

**Prerequisites:** Node.js 20+, MetaMask with Monad Testnet

```bash
# Clone
git clone https://github.com/batuserifcann/monad-blitz.git
cd monad-blitz

# Install & compile contract
npm install
npm run compile

# Setup env
cp .env.example .env
# Add PRIVATE_KEY and CONTRACT_ADDRESS to .env

# Deploy contract (needs MON in wallet)
npm run deploy:monad

# Start server
cd server && npm install && npm run dev

# Start client (new terminal)
cd client && npm install && npm run dev
```

Open `http://localhost:3000`, connect MetaMask, create a game, and battle!

---

## Environment Variables

**Server (.env):**

```
PRIVATE_KEY=your_deployer_private_key
CONTRACT_ADDRESS=deployed_contract_address
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
```

**Client (client/.env.local):**

```
NEXT_PUBLIC_CONTRACT_ADDRESS=deployed_contract_address
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
ANTHROPIC_API_KEY=your_claude_api_key (optional, for AI commentary)
```

---

## Game Rules

| Rule         | Detail                               |
| ------------ | ------------------------------------ |
| Entry        | Choose 10–50 bullets × 0.01 MON each |
| HP           | 100 per tank                         |
| Base Damage  | 10 per hit                           |
| Hit Bonus    | Attack power +2.5 on hit             |
| Miss Penalty | Attack power -2.5 on miss            |
| Min Attack   | 2.5 (never fully useless)            |
| Kill Reward  | Victim's entire MON balance          |
| Winner       | Last tank standing gets 95% of pool  |
| Protocol     | 5% fee on each game                  |

---

## Built At

**Monad Blitz Hackathon — İzmir, March 2026**

Built in one day as a showcase of Monad's parallel EVM capabilities for real-time on-chain gaming.

---
