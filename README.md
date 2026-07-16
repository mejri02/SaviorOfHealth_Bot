# SaviorOfHealth_Bot

Automation script for [saviorofhealth.app](https://saviorofhealth.app/) — handles wallet login (SIWE), daily survey/deck answering, campaigns, wellness goal logging, staking, and optional on-chain badge claiming, with support for multiple accounts, proxies, and Groq AI-generated answers.

## Features

- 🔑 Multi-account support via private keys (`accounts.txt`)
- 🃏 Auto-answers daily "deck" survey cards
- 🏥 Completes clinic campaigns (multi-step chat flows)
- 💪 Logs wellness goals: water, sleep, meals, exercise, meditation, mood
- 💬 Triage chat automation
- 🎯 Auto-staking on wellness goals
- 🏅 Optional on-chain badge (SBT) claiming on BSC
- 🧠 Optional Groq AI–generated answers for more natural/varied responses
- 🔌 Optional HTTP/SOCKS5 proxy rotation per account
- 💤 Runs continuously, sleeping until the next daily reset
- 📄 Auto-generates `config.json` with sensible defaults on first run

## Requirements

- Node.js 18+ (uses native `fetch`)
- npm packages: `ethers`, `socks-proxy-agent`, `https-proxy-agent`

## Installation

```bash
git clone https://github.com/mejri02/SaviorOfHealth_Bot.git
cd SaviorOfHealth_Bot
npm install ethers socks-proxy-agent https-proxy-agent
```

## Setup

### 1. Accounts

Create `accounts.txt` in the project root — one private key per line:

```
# Add your private keys here (one per line)
# Format: privateKey or privateKey:name
0xabc123...:MyMainWallet
0xdef456...
```

### 2. Groq API Keys (optional but recommended)

Create `groq.txt` with one key per line:

```
gsk_xxxxxxxxxxxxxxxxxxxxxxxx
gsk_yyyyyyyyyyyyyyyyyyyyyyyy
```

**Get a free key from the [Groq Console](https://console.groq.com/keys):**
1. Sign up / log in at console.groq.com
2. Go to **API Keys** → **Create API Key**
3. Copy the key (starts with `gsk_`) into `groq.txt`

> ⚠️ **Add more than one Groq API key.** Groq's free tier has strict rate limits per key. The bot automatically rotates between keys (and models) when it hits a 429/rate-limit response, so having 3–5+ keys spread across accounts keeps requests flowing smoothly instead of falling back to random answers.

If `groq.txt` is missing or empty, the bot falls back to randomized answers instead of AI-generated ones.

### 3. Proxies (optional)

Create `proxy.txt` — one proxy per line. Supported formats:

```
http://user:pass@1.2.3.4:8080
socks5://user:pass@1.2.3.4:1080
1.2.3.4:8080
```

### 4. Config

On first run, `config.json` is auto-created with defaults. Key options:

| Option | Description |
|---|---|
| `claimBadges` | Enable/disable on-chain badge claiming |
| `processDeck` / `processCampaigns` / `processWellness` / `processNutrition` / `processMindspace` / `processTriage` | Toggle individual modules |
| `stakeGoals` / `autoStake` / `stakeAmount` | Staking behavior |
| `useGroqAI` | Enable AI-generated answers |
| `maxCardsPerDay` | Cap on deck cards processed per account per day |
| `delayBetweenAccounts` / `delayBetweenRequests` | Timing between actions (ms) |
| `groqModels` | List of Groq models to rotate through |
| `bscRpc` / `badgeContract` / `chainId` | On-chain badge claim settings |
| `sleepUntilNextDay` / `checkIntervalMinutes` | Daily loop behavior |

Edit `config.json` after the first run to adjust these values.

## Usage

```bash
node index.js
```

You'll be prompted with a menu:

```
1. Run without proxy (Direct connection)
2. Run with proxy (Load from proxy.txt)
3. Exit
```

The bot will then loop through all accounts in `accounts.txt`, process each one, print a summary, save results to `results.json`, and sleep until the next daily reset (repeating automatically).

## Output

- `results.json` — per-run and cumulative stats (balances, cards answered, campaigns completed, badges claimed, wellness stats, staking results, etc.)
- Console logs with color-coded status for each action

## Disclaimer

This tool interacts with a third-party web app on your behalf using your own wallet keys. Use at your own risk, review the target platform's terms of service before running automation against it, and never share your private keys or API keys with anyone.

## Links

- 🌐 App: [saviorofhealth.app](https://saviorofhealth.app/)
- 💬 Telegram: [t.me/AirDropXDevs](https://t.me/AirDropXDevs)
- 👤 Author: [mejri02](https://github.com/mejri02)
