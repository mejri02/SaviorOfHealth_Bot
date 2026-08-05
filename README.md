# SaviorOfHealth_Bot

Automation script for [SaviorOfHealth](https://saviorofhealth.app/?ref=K33MUPP8) — handles wallet login (SIWE), daily survey/deck answering, campaigns, wellness goal logging, staking, AI agent interactions, missions, daily quizzes, and optional on-chain badge claiming, with support for multiple accounts, proxies, and Groq AI-generated answers.

## Features

### Core Features
- 🔑 **Multi-account support** via private keys (`accounts.txt`)
- 🃏 **Auto-answers daily "deck" survey cards** with Groq AI or random responses
- 🏥 **Completes clinic campaigns** (multi-step chat flows)
- 💪 **Logs wellness goals**: water, sleep, meals, exercise, meditation, mood tracking
- 💬 **Triage chat automation** for symptom-based health guidance
- 🎯 **Auto-staking** on wellness goals with win/loss tracking
- 🏅 **Optional on-chain badge (SBT) claiming** on BSC
- 🤖 **AI Agent interactions** with 4 specialized agents:
  - Nurse (Nia) - Energy, sleep, stress, mood, activity tracking
  - Gatekeeper (Atlas) - Triage & department routing
  - Nutritionist (Sage) - Meal planning & diet guidance
  - Mindcare (Luna) - Stress relief & mindfulness exercises
- 📋 **Daily check-in automation** for daily bonuses
- 🧪 **Daily quiz completion** with AI-powered answers
- 📊 **Pulse survey answers** with crowd-guessing mechanics
- 🎯 **Mission claiming** (daily, weekly, special event missions)
- 👤 **Profile completion** with randomized health data
- 🔗 **Referral system** with automatic bonus tracking
- 🧠 **Optional Groq AI–generated answers** for natural/varied responses
- 🔌 **Optional HTTP/SOCKS5 proxy rotation** per account
- 💤 **Continuous operation** with sleep until next daily reset
- 📄 **Auto-generates `config.json`** with sensible defaults on first run
- 📊 **Detailed results logging** to `results.json` with daily stats

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
| `processDeck` | Process daily survey cards |
| `processCampaigns` | Complete clinic campaigns |
| `processWellness` | Log wellness goals (water, exercise, sleep, meals) |
| `processNutrition` | Log meal entries |
| `processMindspace` | Log meditation sessions |
| `processTriage` | Complete triage chats |
| `processAgents` | Chat with AI agents (nurse, gatekeeper, nutritionist, mindcare) |
| `processDailyCheckin` | Claim daily check-in bonuses |
| `processDailyQuiz` | Complete daily quiz |
| `processPulse` | Answer pulse surveys with crowd guessing |
| `processReferral` | Track and claim referral bonuses |
| `processMissions` | Claim available missions |
| `completeProfile` | Auto-complete user profile on first run |
| `stakeGoals` / `autoStake` / `stakeAmount` | Staking behavior |
| `useGroqAI` | Enable AI-generated answers (requires Groq API keys) |
| `maxCardsPerDay` | Cap on deck cards processed per account per day (default: 10) |
| `delayBetweenAccounts` | Delay between processing accounts in ms |
| `delayBetweenRequests` | Delay between API requests in ms |
| `groqTimeout` | Timeout for Groq API requests in ms |
| `groqModels` | List of Groq models to rotate through |
| `bscRpc` / `badgeContract` / `chainId` | On-chain badge claim settings |
| `sleepUntilNextDay` | Sleep until next daily reset (default: true) |
| `checkIntervalMinutes` | Interval to check until next day (default: 5 minutes) |
| `maxRetries` | Max retries for failed API requests |
| `retryDelay` | Delay between retries in ms |
| `skipOnServerError` | Skip failed requests instead of retrying |
| `requestTimeout` | Timeout for API requests in ms |

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

The bot will then loop through all accounts in `accounts.txt`, process each one with all enabled modules, print a detailed summary, save results to `results.json`, and sleep until the next daily reset (repeating automatically).

## Processing Workflow

For each account, the bot processes in this order:

1. **Login** - SIWE wallet authentication
2. **Apply Referral** - Auto-apply referral code if not already applied
3. **Profile** - Complete profile if incomplete
4. **Wellness Logging** - Log water, sleep, meals, exercise, meditation, mood, triage
5. **Pulse Survey** - Answer daily pulse with crowd guessing
6. **Daily Quiz** - Complete daily quiz
7. **Daily Deck** - Answer survey cards (up to maxCardsPerDay)
8. **Missions** - Claim available missions
9. **Daily Check-in** - Claim check-in bonus
10. **Pulse Reveal** - Check yesterday's pulse result and bonus
11. **Referral Check** - Track referral earnings
12. **AI Agents** - Chat with all 4 agents (nurse, gatekeeper, nutritionist, mindcare)
13. **Campaigns** - Complete clinic campaigns
14. **Badges** - Claim earned badges on-chain
15. **Staking** - Place and track stakes
16. **Rank Check** - Display current rank and progress

## Output

- `results.json` — detailed per-run and cumulative stats including:
  - Account balances and earned HP
  - Cards answered and campaigns completed
  - Badges claimed
  - Wellness metrics (water, sleep, exercise, meals, meditation, mood)
  - Staking results (placed, won, lost)
  - AI agent chat completions and rewards
  - Mission claims and rewards
  - Daily check-ins, quizzes, and pulse answers completed
  - Rank progression
  - Referral bonuses
- **Console logs** with color-coded status for each action and module

## Features in Detail

### 🤖 AI Agents
The bot interacts with 4 specialized AI agents daily:
- **Nurse (Nia)** - Tracks energy, sleep quality, stress levels, mood, and activity
- **Gatekeeper (Atlas)** - Provides triage guidance for symptoms and health concerns
- **Nutritionist (Sage)** - Offers meal planning and dietary advice
- **Mindcare (Luna)** - Provides mindfulness exercises and stress relief

Each agent chat can reward HP and counts toward daily activity tracking.

### 📊 Wellness Tracking
- **Water logging** (250ml per log)
- **Exercise logging** (minutes with type)
- **Sleep logging** (hours with bedtime/wake time)
- **Meal logging** (meal type, food description, calories)
- **Meditation logging** (minutes with session type)
- **Mood tracking** (1-5 scale)
- **Triage chats** (symptom-based health guidance)

### 🎯 Staking System
- Auto-place stakes on wellness goals
- Track won/lost stakes
- Automatic payout tracking
- Configurable stake amounts

### 🧠 Groq AI Integration
- Uses Groq's free API for natural answer generation
- Supports multiple models: llama-3.1-8b-instant, gemma2-9b-it, mixtral-8x7b-32768
- Automatic key and model rotation on rate limits
- Falls back to random answers if no keys available

## Configuration Examples

### Minimal Setup (Random Answers, No Proxies)
```json
{
  "useGroqAI": false,
  "processDeck": true,
  "processCampaigns": true,
  "processWellness": true,
  "stakeGoals": false
}
```

### Full Automation (AI + All Features)
```json
{
  "useGroqAI": true,
  "maxCardsPerDay": 10,
  "processDeck": true,
  "processCampaigns": true,
  "processWellness": true,
  "processNutrition": true,
  "processMindspace": true,
  "processTriage": true,
  "processAgents": true,
  "processDailyCheckin": true,
  "processDailyQuiz": true,
  "processPulse": true,
  "processReferral": true,
  "processMissions": true,
  "completeProfile": true,
  "stakeGoals": true,
  "autoStake": true,
  "stakeAmount": 10,
  "claimBadges": true,
  "sleepUntilNextDay": true,
  "checkIntervalMinutes": 5
}
```

## Disclaimer

This tool interacts with a third-party web app on your behalf using your own wallet keys. Use at your own risk, review the target platform's terms of service before running automation against it, and never share your private keys or API keys with anyone.

## Security Tips

- 🔒 Store private keys securely; never commit `accounts.txt` to git
- 🔒 Use environment variables for sensitive data in production
- 🔒 Rotate Groq API keys regularly
- 🔒 Use proxies if running multiple accounts to avoid IP bans
- 🔒 Review `config.json` settings before running

## Troubleshooting

### "No accounts found"
- Ensure `accounts.txt` exists and contains valid private keys (0x-prefixed 64-char hex strings)

### Groq API Rate Limit (429)
- Add more Groq API keys to `groq.txt` (3-5+ recommended)
- The bot automatically rotates between keys

### Gateway/Server Errors
- Enable `skipOnServerError` in config to skip failed requests
- Reduce `maxCardsPerDay` if getting rate limited
- Increase `delayBetweenRequests`

### Authentication Failed
- Verify private keys are correct
- Check if wallet has sufficient balance for on-chain badge claiming
- Ensure chain ID matches (default: 56 for BSC)

## Links

- 🌐 **App**: [SaviorOfHealth with Referral](https://saviorofhealth.app/?ref=K33MUPP8)
- 💬 **Telegram**: [t.me/AirDropXDevs](https://t.me/AirDropXDevs)
- 👤 **Author**: [mejri02](https://github.com/mejri02)

---

**Made with ❤️ by mejri02** | [Support the project on GitHub](https://github.com/mejri02/SaviorOfHealth_Bot)
