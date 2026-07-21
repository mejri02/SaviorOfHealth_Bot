#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const readline = require('readline');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const BASE_DIR = __dirname;
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');
const ACCOUNTS_FILE = path.join(BASE_DIR, 'accounts.txt');
const GROQ_KEY_FILE = path.join(BASE_DIR, 'groq.txt');
const PROXY_FILE = path.join(BASE_DIR, 'proxy.txt');
const RESULTS_FILE = path.join(BASE_DIR, 'results.json');

function loadConfig() {
  const defaultConfig = {
    claimBadges: false,
    minBnbBalance: 0.0005,
    processDeck: true,
    processCampaigns: true,
    processWellness: true,
    processNutrition: true,
    processMindspace: true,
    processTriage: true,
    stakeGoals: true,
    stakeAmount: 10,
    autoStake: true,
    useGroqAI: true,
    maxCardsPerDay: 10,
    delayBetweenAccounts: 5000,
    delayBetweenRequests: 2000,
    groqTimeout: 10000,
    groqModels: ['llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
    bscRpc: 'https://bsc-dataseed.binance.org/',
    badgeContract: '0xe0ad72abadf8ea43dd2e168bd97a24f8a04ada91',
    chainId: 56,
    apiUrl: 'https://saviorofhealth.app',
    sleepUntilNextDay: true,
    checkIntervalMinutes: 5,
    maxRetries: 5,
    retryDelay: 3000,
    skipOnServerError: true,
    requestTimeout: 60000,
  };

  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log('📄 Created config.json with default settings');
    return defaultConfig;
  }

  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return { ...defaultConfig, ...config };
  } catch (error) {
    console.log('❌ Error loading config.json, using defaults');
    return defaultConfig;
  }
}

const CONFIG = loadConfig();

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  brightRed: '\x1b[91m',
  brightMagenta: '\x1b[95m',
};

function log(message, type = 'info', data = null) {
  const styles = {
    info: { color: COLORS.cyan, icon: 'ℹ️' },
    success: { color: COLORS.brightGreen, icon: '✅' },
    warning: { color: COLORS.brightYellow, icon: '⚠️' },
    error: { color: COLORS.brightRed, icon: '❌' },
    highlight: { color: COLORS.brightMagenta, icon: '✨' },
    debug: { color: COLORS.gray, icon: '🔍' },
    header: { color: COLORS.brightCyan, icon: '🚀' },
    progress: { color: COLORS.brightGreen, icon: '▶' },
    coin: { color: COLORS.brightYellow, icon: '🪙' },
    badge: { color: COLORS.brightMagenta, icon: '🏅' },
    sleep: { color: COLORS.brightBlue, icon: '💤' },
    groq: { color: COLORS.brightCyan, icon: '🧠' },
    rotate: { color: COLORS.brightYellow, icon: '🔄' },
    config: { color: COLORS.brightWhite, icon: '⚙️' },
    proxy: { color: COLORS.brightYellow, icon: '🔌' },
    wellness: { color: COLORS.brightGreen, icon: '💪' },
    nutrition: { color: COLORS.brightYellow, icon: '🍎' },
    mind: { color: COLORS.brightMagenta, icon: '🧘' },
    stake: { color: COLORS.brightYellow, icon: '🎯' },
    triage: { color: COLORS.brightCyan, icon: '💬' },
    water: { color: COLORS.brightBlue, icon: '💧' },
    mood: { color: COLORS.brightMagenta, icon: '😊' },
    skip: { color: COLORS.brightYellow, icon: '⏭️' },
  };
  const style = styles[type] || styles.info;
  const prefix = `${style.color}${style.icon}${COLORS.reset}`;
  const msg = `${style.color}${message}${COLORS.reset}`;
  if (data) console.log(`${prefix} ${msg}\n${COLORS.gray}${JSON.stringify(data, null, 2)}${COLORS.reset}`);
  else console.log(`${prefix} ${msg}`);
}

function logBanner(message) {
  console.log(`\n${COLORS.brightCyan}${'═'.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.brightYellow}  ${message}  ${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}${'═'.repeat(60)}${COLORS.reset}\n`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 300, max = 1500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatNumber(num) {
  return num.toLocaleString();
}

function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120.0.6099.230 Mobile Safari/537.36',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

function parseAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    const template = '# Add your private keys here (one per line)\n# Format: privateKey or privateKey:name\n\n';
    fs.writeFileSync(ACCOUNTS_FILE, template, 'utf8');
    return [];
  }
  const content = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const accounts = [];
  for (const line of lines) {
    const parts = line.includes(':') ? line.split(':').map(s => s.trim()) : [line.trim()];
    const privateKey = parts[0];
    if (!privateKey.match(/^0x[a-fA-F0-9]{64}$/) && !privateKey.match(/^[a-fA-F0-9]{64}$/)) continue;
    accounts.push({
      privateKey: privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`,
      name: parts[1] || null,
    });
  }
  return accounts;
}

function saveResults(data) {
  try {
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    log(`Failed to save results: ${error.message}`, 'warning');
  }
}

function generateSIWEMessage(address, chainId) {
  const nonce = Math.random().toString(36).substring(2, 18);
  return [
    'saviorofhealth wants you to sign in with your wallet.',
    '',
    `Address: ${address}`,
    `Chain ID: ${chainId || 56}`,
    `Nonce: ${nonce}`,
    `Issued At: ${Date.now()}`,
    '',
    'This is a free, gas-less signature. It only proves you own this wallet. No transaction is sent.'
  ].join('\n');
}

function getNextDayStart() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

function getTimeUntilNextDay() {
  return getNextDayStart() - Date.now();
}

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
    this.loadProxies();
  }

  loadProxies() {
    try {
      if (fs.existsSync(PROXY_FILE)) {
        const content = fs.readFileSync(PROXY_FILE, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        for (const line of lines) {
          const proxy = this.parseProxy(line.trim());
          if (proxy) {
            this.proxies.push(proxy);
          }
        }
        if (this.proxies.length > 0) {
          log(`📋 Loaded ${this.proxies.length} proxies`, 'success');
          return true;
        }
      }
      return false;
    } catch (error) {
      log(`Failed to load proxies: ${error.message}`, 'warning');
      return false;
    }
  }

  parseProxy(line) {
    let proxy = { type: 'http' };
    
    if (line.startsWith('socks5://')) {
      try {
        const url = new URL(line);
        proxy = { type: 'socks5', host: url.hostname, port: parseInt(url.port), username: url.username || null, password: url.password || null };
        return proxy;
      } catch { return null; }
    }
    
    if (line.startsWith('http://') || line.startsWith('https://')) {
      try {
        const url = new URL(line);
        proxy = { type: 'http', host: url.hostname, port: parseInt(url.port), username: url.username || null, password: url.password || null };
        return proxy;
      } catch { return null; }
    }
    
    const parts = line.split(':');
    if (parts.length === 2) {
      const host = parts[0];
      const port = parseInt(parts[1]);
      if (!isNaN(port) && port > 0 && port < 65536) {
        proxy = { type: 'http', host, port };
        return proxy;
      }
    }
    
    return null;
  }

  getRandomProxy() {
    if (this.proxies.length === 0) return null;
    return this.proxies[Math.floor(Math.random() * this.proxies.length)];
  }

  getAgent(proxy) {
    if (!proxy) return null;
    try {
      if (proxy.type === 'socks5') {
        let url = `socks5://`;
        if (proxy.username && proxy.password) url += `${proxy.username}:${proxy.password}@`;
        url += `${proxy.host}:${proxy.port}`;
        return new SocksProxyAgent(url);
      } else {
        let url = `http://`;
        if (proxy.username && proxy.password) url += `${proxy.username}:${proxy.password}@`;
        url += `${proxy.host}:${proxy.port}`;
        return new HttpsProxyAgent(url);
      }
    } catch (error) {
      return null;
    }
  }

  getProxyCount() {
    return this.proxies.length;
  }
}

class GroqManager {
  constructor() {
    this.apiKeys = [];
    this.currentKeyIndex = 0;
    this.currentModelIndex = 0;
    this.models = CONFIG.groqModels || ['llama-3.1-8b-instant'];
    this.failedKeys = new Set();
    this.rateLimitedKeys = new Set();
    this.keyUsageCount = {};
    this.loadApiKeys();
  }

  loadApiKeys() {
    try {
      if (fs.existsSync(GROQ_KEY_FILE)) {
        const content = fs.readFileSync(GROQ_KEY_FILE, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        for (const line of lines) {
          const key = line.trim();
          if (key.startsWith('gsk_')) {
            this.apiKeys.push(key);
            this.keyUsageCount[key] = 0;
          }
        }
        if (this.apiKeys.length > 0) {
          log(`📋 Loaded ${this.apiKeys.length} Groq API keys`, 'success');
          return true;
        }
      }
      log(`⚠️ No Groq API keys found in groq.txt`, 'warning');
      return false;
    } catch (error) {
      log(`Failed to load Groq API keys: ${error.message}`, 'warning');
      return false;
    }
  }

  getCurrentKey() {
    if (this.apiKeys.length === 0) return null;
    let attempts = 0;
    while (attempts < this.apiKeys.length) {
      const key = this.apiKeys[this.currentKeyIndex];
      if (!this.failedKeys.has(key) && !this.rateLimitedKeys.has(key)) {
        return key;
      }
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      attempts++;
    }
    this.failedKeys.clear();
    this.rateLimitedKeys.clear();
    return this.apiKeys[this.currentKeyIndex] || null;
  }

  getCurrentModel() {
    return this.models[this.currentModelIndex] || this.models[0];
  }

  rotateKey() {
    if (this.apiKeys.length === 0) return null;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    log(`🔄 Rotated API key`, 'rotate');
    return this.apiKeys[this.currentKeyIndex];
  }

  rotateModel() {
    if (this.models.length === 0) return null;
    this.currentModelIndex = (this.currentModelIndex + 1) % this.models.length;
    log(`🔄 Rotated model: ${this.models[this.currentModelIndex]}`, 'rotate');
    return this.models[this.currentModelIndex];
  }

  async ask(question, options = null, proxyManager = null) {
    if (this.apiKeys.length === 0 || !CONFIG.useGroqAI) {
      return options ? options[Math.floor(Math.random() * options.length)] : 'I feel good today.';
    }

    let attempts = 0;
    const maxAttempts = Math.max(this.apiKeys.length * 2, 5);

    while (attempts < maxAttempts) {
      const key = this.getCurrentKey();
      const model = this.getCurrentModel();
      
      if (!key) {
        return options ? options[Math.floor(Math.random() * options.length)] : 'I feel good today.';
      }

      try {
        const prompt = `You are answering health survey questions. Answer naturally and concisely.

Question: ${question}
${options ? `Options: ${options.join(', ')}` : ''}

${options ? 'Respond with ONLY the option text you choose, nothing else.' : 'Give a 1-3 word honest response.'}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.groqTimeout || 10000);

        const fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'User-Agent': getRandomUserAgent(),
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: 'You are a helpful health assistant answering survey questions honestly and concisely.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.5,
            max_tokens: 30,
          }),
          signal: controller.signal
        };

        if (proxyManager) {
          const proxy = proxyManager.getRandomProxy();
          if (proxy) {
            const agent = proxyManager.getAgent(proxy);
            if (agent) fetchOptions.agent = agent;
          }
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', fetchOptions);
        clearTimeout(timeoutId);

        if (response.status === 429) {
          this.markKeyRateLimited(key);
          this.rotateModel();
          await sleep(2000);
          continue;
        }

        if (response.status === 401 || response.status === 403) {
          this.markKeyFailed(key);
          await sleep(1000);
          continue;
        }

        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
          let answer = data.choices[0].message.content.trim();
          this.keyUsageCount[key] = (this.keyUsageCount[key] || 0) + 1;
          
          if (options && options.length > 0) {
            for (const opt of options) {
              if (answer.toLowerCase().includes(opt.toLowerCase()) || 
                  opt.toLowerCase().includes(answer.toLowerCase())) {
                return opt;
              }
            }
            return options[0];
          }
          return answer;
        }

        if (data.error) {
          if (data.error.message?.includes('rate') || data.error.message?.includes('quota')) {
            this.markKeyRateLimited(key);
          } else {
            this.rotateKey();
          }
          this.rotateModel();
          await sleep(1000);
        }

      } catch (error) {
        if (error.name === 'AbortError') {
          log(`⏱️ Groq request timeout (${CONFIG.groqTimeout}ms)`, 'warning');
          this.rotateKey();
          this.rotateModel();
        } else {
          log(`Groq request error: ${error.message}`, 'warning');
          this.rotateKey();
        }
        await sleep(1000);
      }

      attempts++;
    }

    return options ? options[Math.floor(Math.random() * options.length)] : 'I feel good today.';
  }

  markKeyFailed(key) {
    if (!key) return;
    this.failedKeys.add(key);
    this.rotateKey();
  }

  markKeyRateLimited(key) {
    if (!key) return;
    this.rateLimitedKeys.add(key);
    this.rotateKey();
  }
}

class ApiClient {
  constructor(proxyManager = null) {
    this.proxyManager = proxyManager;
    this.token = null;
    this.tokenExpiry = null;
    this.userAgent = getRandomUserAgent();
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.maxRequestsPerSecond = 5;
  }

  setToken(token) {
    this.token = token;
    this.tokenExpiry = Date.now() + 3600000;
  }

  refreshUserAgent() {
    this.userAgent = getRandomUserAgent();
  }

  isTokenExpired() {
    return this.tokenExpiry && Date.now() > this.tokenExpiry;
  }

  async request(endpoint, options = {}) {
    this.requestCount++;
    const now = Date.now();
    if (this.requestCount > this.maxRequestsPerSecond && now - this.lastRequestTime < 1000) {
      await sleep(randomDelay(500, 1500));
    }
    this.lastRequestTime = now;

    const url = `${CONFIG.apiUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
      'Accept': 'application/json',
      ...options.headers
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const fetchOptions = { 
      ...options, 
      headers,
      timeout: CONFIG.requestTimeout || 60000,
    };

    if (this.proxyManager) {
      const proxy = this.proxyManager.getRandomProxy();
      if (proxy) {
        const agent = this.proxyManager.getAgent(proxy);
        if (agent) fetchOptions.agent = agent;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeout || 60000);
    fetchOptions.signal = controller.signal;

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';

      if (response.status === 401) {
        throw new Error('AUTH_EXPIRED');
      }

      if (response.status === 504 || response.status === 502 || response.status === 503) {
        log(`⚠️ Gateway error (${response.status}) on ${endpoint}`, 'warning');
        throw new Error(`GATEWAY_ERROR`);
      }

      if (response.status === 500) {
        log(`⚠️ Server error (500) on ${endpoint}`, 'warning');
        throw new Error(`SERVER_ERROR`);
      }

      const text = await response.text();

      if (!text || text.trim() === '') {
        throw new Error('Empty response from server');
      }

      if (!contentType.includes('application/json')) {
        if (text.includes('<html') || text.includes('<!DOCTYPE')) {
          throw new Error(`HTML response received (status ${response.status})`);
        }
        throw new Error(`Non-JSON response: ${text.substring(0, 100)}`);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON: ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.error?.message || data.message || `HTTP ${response.status}`);
      }

      await sleep(randomDelay(200, 600));
      return data;

    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message === 'GATEWAY_ERROR') throw error;
      if (error.message === 'SERVER_ERROR') throw error;
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async requestWithRetry(endpoint, options = {}, maxRetries = CONFIG.maxRetries || 5) {
    let lastError;
    let retryDelay = CONFIG.retryDelay || 3000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;
        
        if (error.message === 'AUTH_EXPIRED') throw error;
        if (error.message.includes('400') || error.message.includes('422')) throw error;
        
        if ((error.message === 'SERVER_ERROR' || error.message === 'GATEWAY_ERROR') && CONFIG.skipOnServerError) {
          log(`⏭️ Server/gateway error, skipping this request`, 'skip');
          return null;
        }
        
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(1.5, attempt - 1);
          log(`🔄 Retry ${attempt}/${maxRetries} for ${endpoint} in ${Math.round(delay/1000)}s...`, 'warning');
          await sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
}

class BadgeClaimer {
  constructor(privateKey, proxyManager = null) {
    this.privateKey = privateKey;
    this.proxyManager = proxyManager;
    this.wallet = null;
    this.provider = null;
    this.contract = null;
  }

  async init() {
    this.wallet = new ethers.Wallet(this.privateKey);
    
    let providerOptions = {};
    if (this.proxyManager) {
      const proxy = this.proxyManager.getRandomProxy();
      if (proxy) {
        const agent = this.proxyManager.getAgent(proxy);
        if (agent) {
          providerOptions.agent = agent;
        }
      }
    }
    
    this.provider = new ethers.JsonRpcProvider(CONFIG.bscRpc, undefined, providerOptions);
    this.wallet = this.wallet.connect(this.provider);
    
    const abi = [
      'function claim(string badgeKey, bytes signature) external',
      'function hasClaimed(address wallet, string badgeKey) view returns (bool)'
    ];
    this.contract = new ethers.Contract(CONFIG.badgeContract, abi, this.wallet);
  }

  async getBalance() {
    return await this.provider.getBalance(this.wallet.address);
  }

  async claimBadge(badgeKey, signature) {
    try {
      const gasPrice = await this.provider.getFeeData();
      const tx = await this.contract.claim(badgeKey, signature, {
        gasLimit: 300000,
        gasPrice: gasPrice.gasPrice,
      });
      
      log(`  ⛓️ Transaction sent: ${tx.hash.substring(0, 20)}...`, 'debug');
      const receipt = await tx.wait(1);
      
      if (receipt.status === 1) {
        log(`  ✅ Badge claimed on-chain!`, 'success');
        return receipt.transactionHash;
      }
      return null;
    } catch (error) {
      log(`  ❌ Claim failed: ${error.message}`, 'error');
      return null;
    }
  }
}

class SaviorOfHealthBot {
  constructor(useProxy = false) {
    this.proxyManager = useProxy ? new ProxyManager() : null;
    this.apiClient = new ApiClient(this.proxyManager);
    this.groq = new GroqManager();
    this.wallet = null;
    this.address = null;
    this.balance = 0;
    this.earnedToday = 0;
    this.cards = [];
    this.campaigns = [];
    this.badges = [];
    this.completedCards = [];
    this.completedCampaigns = [];
    this.claimedBadges = [];
    this.totalEarned = 0;
    this.useProxy = useProxy;
    this.goals = null;
    this.stakeGoals = null;
    this.chainId = CONFIG.chainId || 56;
    this.dailyStats = {
      accountsProcessed: 0,
      totalHP: 0,
      totalCardsAnswered: 0,
      totalCampaignsCompleted: 0,
      badgesClaimed: 0,
      aiAnswers: 0,
      aiAttempts: 0,
      wellnessGoalsCompleted: 0,
      mealsLogged: 0,
      exerciseMinutes: 0,
      sleepHours: 0,
      meditationMinutes: 0,
      triageChats: 0,
      waterMl: 0,
      moodLogged: false,
      stakesPlaced: 0,
      stakesWon: 0,
      stakesLost: 0,
    };
  }

  async login(privateKey, forceRefresh = false) {
    try {
      if (!forceRefresh && this.apiClient.token && !this.apiClient.isTokenExpired()) {
        return true;
      }

      const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      this.wallet = new ethers.Wallet(pk);
      this.address = this.wallet.address;
      
      const shortAddr = `${this.address.substring(0, 8)}...${this.address.substring(this.address.length - 6)}`;
      log(`🔑 ${shortAddr}`, 'info');
      
      let chainId = CONFIG.chainId || 56;
      if (this.provider) {
        try {
          const network = await this.provider.getNetwork();
          chainId = Number(network.chainId);
        } catch (e) {}
      }
      
      const message = generateSIWEMessage(this.address, chainId);
      const signature = await this.wallet.signMessage(message);
      
      const response = await this.apiClient.request('/api/auth/wallet/siwe', {
        method: 'POST',
        body: JSON.stringify({ message, signature })
      });
      
      if (!response.token) {
        throw new Error(response.error || 'Sign-in failed');
      }
      
      this.apiClient.setToken(response.token);
      this.balance = response.user?.tokenBalance || 0;
      this.chainId = chainId;
      
      log(`✅ Authenticated (Chain: ${chainId})`, 'success');
      return true;
      
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') {
        log(`🔄 Token expired, re-authenticating...`, 'warning');
        return this.login(privateKey, true);
      }
      log(`❌ Auth failed: ${error.message}`, 'error');
      return false;
    }
  }

  async fetchDeck() {
    try {
      const data = await this.apiClient.requestWithRetry('/api/earn/deck', { method: 'GET' });
      this.cards = data.cards || [];
      this.balance = data.balance || 0;
      this.earnedToday = data.earnedToday || 0;
      this.completedCards = this.cards.filter(c => c.answered).map(c => c.id);
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      log(`Failed to fetch deck: ${error.message}`, 'error');
      return null;
    }
  }

  async answerCard(cardId, answer, crowdGuess = null) {
    const payload = { surveyId: cardId, answer };
    if (crowdGuess !== null) payload.crowdGuess = crowdGuess;
    
    try {
      const data = await this.apiClient.requestWithRetry('/api/earn/answer', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (!data || data === null) {
        const card = this.cards.find(c => c.id === cardId);
        if (card) card.answered = true;
        return { ok: true, reward: 0, skipped: true };
      }
      
      if (!data.ok) {
        throw new Error('Invalid response from server');
      }
      
      this.balance = data.balance || this.balance;
      this.earnedToday = data.earnedToday || 0;
      
      const card = this.cards.find(c => c.id === cardId);
      if (card) card.answered = true;
      
      this.totalEarned += data.reward || 0;
      this.dailyStats.totalCardsAnswered++;
      
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      
      if ((error.message === 'SERVER_ERROR' || error.message === 'GATEWAY_ERROR') && CONFIG.skipOnServerError) {
        log(`  ⏭️ Server/gateway error, skipping this card`, 'skip');
        const card = this.cards.find(c => c.id === cardId);
        if (card) card.answered = true;
        return { ok: true, reward: 0, skipped: true };
      }
      
      if (error.message.includes('Empty response') || error.message.includes('Invalid JSON') || error.message.includes('HTML response')) {
        log(`  ⚠️ Invalid response. Skipping card.`, 'warning');
        const card = this.cards.find(c => c.id === cardId);
        if (card) card.answered = true;
        return { ok: true, reward: 0, skipped: true };
      }
      
      log(`  ❌ Failed to answer card: ${error.message}`, 'error');
      const card = this.cards.find(c => c.id === cardId);
      if (card) card.answered = true;
      return null;
    }
  }

  async processDeck() {
    if (!CONFIG.processDeck) {
      log(`⏭️ Deck processing disabled`, 'warning');
      return 0;
    }

    logBanner('🃏 Processing Daily Deck');
    
    let cardCount = 0;
    let attempts = 0;
    const maxAttempts = CONFIG.maxCardsPerDay || 10;
    let consecutiveFailures = 0;
    let serverErrorCount = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      await this.fetchDeck();
      
      const unanswered = this.cards.filter(card => !card.answered);
      if (unanswered.length === 0) break;
      
      const card = unanswered[0];
      cardCount++;
      
      const preview = card.question ? card.question.substring(0, 35) : 'Question';
      log(`📝 ${cardCount}/${this.cards.length}: ${preview}...`, 'info');
      
      let answer = null;
      let guess = null;
      
      if (CONFIG.useGroqAI && this.groq.apiKeys.length > 0) {
        this.dailyStats.aiAttempts++;
        
        if (card.type === 'task') {
          answer = 'done';
        } else if (card.options && card.options.length > 0) {
          answer = await this.groq.ask(card.question, card.options, this.proxyManager);
          if (!answer) answer = card.options[Math.floor(Math.random() * card.options.length)];
        } else {
          answer = await this.groq.ask(card.question, null, this.proxyManager);
          if (!answer) answer = 'I feel good today.';
        }
        
        if (card.predict && answer) {
          guess = Math.floor(25 + Math.random() * 50);
        }
        
        this.dailyStats.aiAnswers++;
        log(`  🤖 Answer: ${answer}`, 'debug');
        if (guess) log(`  🎯 Guess: ${guess}%`, 'debug');
      } else {
        if (card.type === 'task') {
          answer = 'done';
        } else if (card.options && card.options.length > 0) {
          answer = card.options[Math.floor(Math.random() * card.options.length)];
        } else {
          answer = 'I feel good today.';
        }
        if (card.predict) {
          guess = Math.floor(25 + Math.random() * 50);
        }
      }
      
      const result = await this.answerCard(card.id, answer, guess);
      
      if (result && result.ok !== false) {
        consecutiveFailures = 0;
        if (result.reward) {
          log(`  ${COLORS.brightYellow}🪙 +${result.reward} HP${COLORS.reset} (Balance: ${COLORS.brightWhite}${formatNumber(this.balance)}${COLORS.reset})`, 'success');
          if (result.accuracy !== undefined && result.accuracy !== null) {
            log(`  📊 Accuracy: ${result.accuracy}%`, 'debug');
          }
        }
      } else {
        consecutiveFailures++;
        serverErrorCount++;
        log(`  ⚠️ Failed to answer card (${consecutiveFailures} consecutive failures)`, 'warning');
        
        if (serverErrorCount >= 5) {
          log(`  ⛔ Too many server errors (${serverErrorCount}), stopping deck processing`, 'error');
          break;
        }
        
        if (consecutiveFailures >= 3) {
          log(`  ⛔ Too many failures, skipping remaining cards`, 'error');
          break;
        }
      }
      
      await sleep(randomDelay(2000, 4000));
    }
    
    if (cardCount > 0) {
      log(`✅ Completed ${cardCount} cards`, 'success');
    } else {
      log(`📭 No new cards available`, 'info');
    }
    
    return cardCount;
  }

  async fetchCampaigns() {
    try {
      const data = await this.apiClient.requestWithRetry('/api/campaigns', { method: 'GET' });
      this.campaigns = data.campaigns || [];
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      log(`Failed to fetch campaigns: ${error.message}`, 'error');
      return null;
    }
  }

  async processCampaigns() {
    if (!CONFIG.processCampaigns) {
      log(`⏭️ Campaign processing disabled`, 'warning');
      return 0;
    }

    logBanner('🏥 Processing Clinic Campaigns');
    
    await this.fetchCampaigns();
    
    const activeCampaigns = this.campaigns.filter(campaign => {
      if (!campaign.items || campaign.items.length === 0) return false;
      return campaign.items.some(item => !item.answered);
    });
    
    if (activeCampaigns.length === 0) {
      log(`📭 No active campaigns`, 'info');
      return 0;
    }
    
    let completed = 0;
    let totalReward = 0;
    let serverErrorCount = 0;
    
    for (const campaign of activeCampaigns) {
      if (serverErrorCount >= 3) {
        log(`⛔ Too many server errors, stopping campaigns`, 'error');
        break;
      }
      
      const title = campaign.title?.substring(0, 35) || campaign.key || 'Campaign';
      log(`📋 ${title}...`, 'info');
      
      try {
        const startData = await this.apiClient.requestWithRetry('/api/earn/log-chat', {
          method: 'POST',
          body: JSON.stringify({ startCampaign: campaign.key })
        });
        
        let currentAsk = startData.ask;
        let questionCount = 0;
        let campaignReward = 0;
        
        while (currentAsk) {
          questionCount++;
          
          let answer;
          if (CONFIG.useGroqAI && this.groq.apiKeys.length > 0) {
            this.dailyStats.aiAttempts++;
            
            if (currentAsk.kind === 'text') {
              answer = await this.groq.ask(currentAsk.options?.[0] || 'How are you?', null, this.proxyManager);
              if (!answer) answer = 'I feel healthy today.';
            } else if (currentAsk.kind === 'multi') {
              const shuffled = [...currentAsk.options].sort(() => Math.random() - 0.5);
              answer = shuffled.slice(0, Math.min(currentAsk.options.length, 1 + Math.floor(Math.random() * 2)));
            } else {
              answer = await this.groq.ask(currentAsk.options?.[0] || 'How are you?', currentAsk.options, this.proxyManager);
              if (!answer) answer = currentAsk.options[Math.floor(Math.random() * currentAsk.options.length)];
            }
            this.dailyStats.aiAnswers++;
          } else {
            if (currentAsk.kind === 'text') {
              answer = 'I feel healthy today.';
            } else if (currentAsk.kind === 'multi') {
              const shuffled = [...currentAsk.options].sort(() => Math.random() - 0.5);
              answer = shuffled.slice(0, Math.min(currentAsk.options.length, 1 + Math.floor(Math.random() * 2)));
            } else {
              answer = currentAsk.options[Math.floor(Math.random() * currentAsk.options.length)];
            }
          }
          
          const response = await this.apiClient.requestWithRetry('/api/earn/log-chat', {
            method: 'POST',
            body: JSON.stringify({
              message: typeof answer === 'string' ? answer : answer.join(', '),
              focusCampaign: campaign.key,
              pendingAskKey: currentAsk.key,
              surveyKey: currentAsk.key
            })
          });
          
          if (response && response.reward) {
            this.balance = response.balance || this.balance;
            this.totalEarned += response.reward;
            campaignReward += response.reward;
            this.dailyStats.totalCampaignsCompleted++;
            log(`  ${COLORS.brightYellow}🪙 +${response.reward} HP${COLORS.reset}`, 'success');
          }
          
          currentAsk = response?.ask;
          await sleep(randomDelay(500, 1500));
        }
        
        completed++;
        this.completedCampaigns.push(campaign.key);
        
        if (campaignReward > 0) {
          log(`✅ +${campaignReward} HP from campaign`, 'success');
          totalReward += campaignReward;
        }
        
      } catch (error) {
        if (error.message === 'AUTH_EXPIRED') throw error;
        if (error.message === 'SERVER_ERROR' || error.message === 'GATEWAY_ERROR') {
          serverErrorCount++;
          log(`⚠️ Server/gateway error on campaign (${serverErrorCount}/3)`, 'warning');
        } else {
          log(`❌ Campaign failed: ${error.message}`, 'error');
        }
      }
      
      await sleep(randomDelay(2000, 4000));
    }
    
    if (completed > 0) {
      log(`✅ Completed ${completed} campaigns (${totalReward} HP)`, 'success');
    }
    
    return completed;
  }

  async fetchBadges() {
    try {
      const data = await this.apiClient.requestWithRetry('/api/badges/sbt', { method: 'GET' });
      this.badges = data.badges || [];
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      log(`Failed to fetch badges: ${error.message}`, 'error');
      return null;
    }
  }

  async processBadges() {
    if (!CONFIG.claimBadges) {
      log(`⏭️ Badge claiming disabled`, 'warning');
      return 0;
    }

    logBanner('🏅 Checking Badges');
    
    await this.fetchBadges();
    
    const claimable = this.badges.filter(badge => badge.earned && !badge.claimed);
    
    if (claimable.length === 0) {
      log(`📭 No claimable badges`, 'info');
      return 0;
    }
    
    let claimed = 0;
    
    for (const badge of claimable) {
      log(`  🏅 ${badge.name} (${badge.tier})`, 'info');
      
      try {
        const signatureData = await this.apiClient.requestWithRetry('/api/badges/sbt', {
          method: 'POST',
          body: JSON.stringify({ badgeKey: badge.key })
        });
        
        if (signatureData?.signature) {
          const badgeClaimer = new BadgeClaimer(this.wallet.privateKey, this.proxyManager);
          await badgeClaimer.init();
          const txHash = await badgeClaimer.claimBadge(badge.key, signatureData.signature);
          if (txHash) {
            await this.apiClient.requestWithRetry('/api/badges/sbt/confirm', {
              method: 'POST',
              body: JSON.stringify({ badgeKey: badge.key, txHash })
            });
            claimed++;
            this.dailyStats.badgesClaimed++;
            log(`    ✅ ${badge.name} claimed!`, 'success');
          }
          await sleep(randomDelay(1000, 2000));
        }
      } catch (error) {
        if (error.message === 'AUTH_EXPIRED') throw error;
        log(`  ❌ Failed to get signature for ${badge.name}: ${error.message}`, 'error');
      }
    }
    
    if (claimed > 0) {
      log(`✅ Claimed ${claimed} badges`, 'success');
    }
    
    return claimed;
  }

  async fetchGoals() {
    try {
      const data = await this.apiClient.requestWithRetry('/api/goals', { method: 'GET' });
      this.goals = data;
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message === 'SERVER_ERROR' || error.message === 'GATEWAY_ERROR') {
        log(`⚠️ Goals API unavailable (server/gateway error)`, 'warning');
        return null;
      }
      log(`Failed to fetch goals: ${error.message}`, 'error');
      return null;
    }
  }

  async processWellness() {
    if (!CONFIG.processWellness) {
      log(`⏭️ Wellness processing disabled`, 'warning');
      return 0;
    }

    logBanner('💪 Processing Wellness Goals');
    
    await this.fetchGoals();
    
    if (!this.goals || !this.goals.today || !this.goals.today.goals) {
      log(`📭 No wellness goals for today`, 'info');
      return 0;
    }
    
    let completed = 0;
    let serverErrorCount = 0;
    
    for (const goal of this.goals.today.goals) {
      if (serverErrorCount >= 5) {
        log(`⛔ Too many server errors, stopping wellness goals`, 'error');
        break;
      }
      
      if (!goal.done) {
        try {
          switch (goal.key) {
            case 'hydrate':
              await this.logWater(250);
              break;
            case 'sleep':
              await this.logSleep(goal.target || 7);
              break;
            case 'fuel':
              await this.logMeal();
              break;
            case 'move':
              await this.logExercise(goal.target || 20);
              break;
            case 'mind':
            case 'meditate':
              await this.logMeditation(goal.target || 5);
              break;
            case 'answer':
              break;
            case 'triage':
              await this.triageChat();
              break;
            default:
              log(`  ⚠️ Unknown goal type: ${goal.key}`, 'warning');
          }
        } catch (error) {
          if (error.message === 'SERVER_ERROR' || error.message === 'GATEWAY_ERROR') {
            serverErrorCount++;
            log(`⚠️ Server/gateway error on wellness (${serverErrorCount}/5)`, 'warning');
          }
        }
        await sleep(randomDelay(500, 1500));
      }
    }
    
    await this.fetchGoals();
    
    if (this.goals && this.goals.today) {
      for (const goal of this.goals.today.goals) {
        if (goal.done && !goal._completed) {
          goal._completed = true;
          completed++;
          this.dailyStats.wellnessGoalsCompleted++;
          log(`  ✅ ${goal.label} - completed!`, 'success');
        }
      }
    }
    
    if (completed > 0) {
      log(`✅ Completed ${completed} wellness goals`, 'success');
    }
    
    return completed;
  }

  async logWater(ml) {
    try {
      const amount = Math.max(ml || 250, 250);
      const data = await this.apiClient.requestWithRetry('/api/logs/water', {
        method: 'POST',
        body: JSON.stringify({ amountMl: amount })
      });
      this.dailyStats.waterMl += amount;
      log(`  💧 Logged ${amount}ml water`, 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log(`  ⚠️ Already logged water today`, 'warning');
        return null;
      }
      if (error.message !== 'SERVER_ERROR' && error.message !== 'GATEWAY_ERROR') {
        log(`  ❌ Failed to log water: ${error.message}`, 'error');
      }
      return null;
    }
  }

  async logExercise(minutes) {
    if (!CONFIG.processWellness) return null;
    
    try {
      const min = Math.max(minutes || 20, 10 + Math.floor(Math.random() * 30));
      const data = await this.apiClient.requestWithRetry('/api/logs/exercise', {
        method: 'POST',
        body: JSON.stringify({ 
          exerciseType: 'walking',
          durationMin: min
        })
      });
      this.dailyStats.exerciseMinutes += min;
      log(`  🏃 Logged ${min}min exercise`, 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log(`  ⚠️ Already logged exercise today`, 'warning');
        return null;
      }
      return null;
    }
  }

  async logSleep(hours) {
    try {
      const h = Math.max(hours || 7, 5 + Math.random() * 4);
      const now = new Date();
      const bedtime = new Date(now);
      bedtime.setHours(23, 0, 0, 0);
      const wakeTime = new Date(bedtime);
      wakeTime.setHours(bedtime.getHours() + h, 0, 0, 0);
      
      const data = await this.apiClient.requestWithRetry('/api/logs/sleep', {
        method: 'POST',
        body: JSON.stringify({ 
          bedtime: bedtime.toISOString(),
          wakeTime: wakeTime.toISOString()
        })
      });
      this.dailyStats.sleepHours += h;
      log(`  😴 Logged ${h.toFixed(1)}h sleep`, 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log(`  ⚠️ Already logged sleep today`, 'warning');
        return null;
      }
      return null;
    }
  }

  async logMeal() {
    if (!CONFIG.processNutrition) return null;
    
    try {
      const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
      const foods = ['Oatmeal with berries', 'Grilled chicken salad', 'Salmon with rice', 'Pasta with vegetables', 'Fruit smoothie', 'Eggs and toast'];
      const meal = meals[Math.floor(Math.random() * meals.length)];
      const food = foods[Math.floor(Math.random() * foods.length)];
      const calories = 200 + Math.floor(Math.random() * 400);
      
      const data = await this.apiClient.requestWithRetry('/api/logs/meal', {
        method: 'POST',
        body: JSON.stringify({
          mealType: meal,
          description: food,
          calories: calories
        })
      });
      this.dailyStats.mealsLogged++;
      log(`  🍽️ Logged ${meal}: ${food} (${calories} cal)`, 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log(`  ⚠️ Already logged a meal today`, 'warning');
        return null;
      }
      return null;
    }
  }

  async logMeditation(minutes) {
    if (!CONFIG.processMindspace) return null;
    
    try {
      const min = Math.max(minutes || 5, 3 + Math.floor(Math.random() * 10));
      const data = await this.apiClient.requestWithRetry('/api/logs/meditation', {
        method: 'POST',
        body: JSON.stringify({ 
          durationMin: min,
          sessionType: 'guided'
        })
      });
      this.dailyStats.meditationMinutes += min;
      log(`  🧘 Logged ${min}min meditation`, 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log(`  ⚠️ Already logged meditation today`, 'warning');
        return null;
      }
      return null;
    }
  }

  async logMood(score) {
    try {
      const s = score || Math.floor(3 + Math.random() * 3);
      const data = await this.apiClient.requestWithRetry('/api/logs/mood', {
        method: 'POST',
        body: JSON.stringify({ score: s })
      });
      this.dailyStats.moodLogged = true;
      log(`  😊 Logged mood: ${s}/5`, 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log(`  ⚠️ Already logged mood today`, 'warning');
        return null;
      }
      return null;
    }
  }

  async triageChat() {
    if (!CONFIG.processTriage) {
      log(`⏭️ Triage processing disabled`, 'warning');
      return null;
    }
    
    try {
      const symptoms = [
        'I have a headache and fever',
        'Feeling tired with muscle aches',
        'Cough and sore throat for 2 days',
        'Stomach pain after eating',
        'Anxiety and trouble sleeping',
        'Dizziness when standing up',
        'Nausea and headache'
      ];
      const symptom = symptoms[Math.floor(Math.random() * symptoms.length)];
      
      const data = await this.apiClient.requestWithRetry('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ 
          message: symptom,
          agentType: 'gatekeeper'
        })
      });
      
      this.dailyStats.triageChats++;
      
      if (data?.reward && data.reward.awarded) {
        this.balance = data.balance || this.balance;
        this.totalEarned += data.reward.amount || 0;
        log(`  💬 +${data.reward.amount} HP for triage chat`, 'success');
      } else {
        log(`  💬 Triage chat completed`, 'success');
      }
      
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log(`  ⚠️ Already completed triage today`, 'warning');
        return null;
      }
      if (error.message !== 'SERVER_ERROR' && error.message !== 'GATEWAY_ERROR') {
        log(`  ❌ Failed to triage chat: ${error.message}`, 'error');
      }
      return null;
    }
  }

  async fetchStakeGoals() {
    try {
      const data = await this.apiClient.requestWithRetry('/api/stake', { method: 'GET' });
      this.stakeGoals = data;
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      log(`Failed to fetch stake goals: ${error.message}`, 'error');
      return null;
    }
  }

  async placeStake(goalKey, amount, label) {
    try {
      const data = await this.apiClient.requestWithRetry('/api/stake', {
        method: 'POST',
        body: JSON.stringify({ 
          goalKey: goalKey,
          amount: amount,
          label: label || goalKey
        })
      });
      this.dailyStats.stakesPlaced++;
      if (data?.balance) this.balance = data.balance;
      log(`  🎯 Staked ${amount} HP on ${label || goalKey}`, 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log(`  ⚠️ Already staked on ${goalKey} today`, 'warning');
      } else if (error.message !== 'SERVER_ERROR' && error.message !== 'GATEWAY_ERROR') {
        log(`  ❌ Failed to stake on ${goalKey}: ${error.message}`, 'error');
      }
      return null;
    }
  }

  async processStaking() {
    if (!CONFIG.stakeGoals) {
      log(`⏭️ Staking disabled`, 'warning');
      return 0;
    }

    logBanner('🎯 Processing Staking');
    
    await this.fetchStakeGoals();
    
    if (!this.stakeGoals) {
      log(`❌ Failed to fetch stake goals`, 'error');
      return 0;
    }
    
    if (this.stakeGoals.history) {
      const wonStakes = this.stakeGoals.history.filter(s => s.status === 'won' && !s._claimed);
      for (const stake of wonStakes) {
        stake._claimed = true;
        this.dailyStats.stakesWon++;
        this.balance = this.stakeGoals.balance || this.balance;
        this.totalEarned += stake.payout || 0;
        log(`  🎯 Won stake! +${stake.payout} HP for ${stake.label}`, 'success');
      }
    }
    
    if (CONFIG.autoStake && this.stakeGoals.goals) {
      const stakeable = this.stakeGoals.goals.filter(g => g.editable !== false);
      const amount = CONFIG.stakeAmount || 10;
      let staked = 0;
      for (const goal of stakeable) {
        if (staked >= 3) break;
        if (this.balance >= amount) {
          await this.placeStake(goal.key, amount, goal.label);
          staked++;
          await sleep(randomDelay(500, 1000));
        } else {
          log(`  ⚠️ Insufficient HP to stake on ${goal.key}`, 'warning');
          break;
        }
      }
    }
    
    return 0;
  }

  async processAccount(account) {
    const shortAddr = this.address ? 
      `${this.address.substring(0, 8)}...${this.address.substring(this.address.length - 6)}` : 
      'unknown';
    
    logBanner(`👤 Account ${shortAddr}`);
    if (this.useProxy && this.proxyManager) {
      log(`🔌 Using proxies (${this.proxyManager.getProxyCount()} available)`, 'proxy');
    }
    
    this.dailyStats.accountsProcessed++;
    this.apiClient.refreshUserAgent();
    
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (await this.login(account.privateKey)) {
        loginSuccess = true;
        break;
      }
      if (attempt < 3) {
        log(`🔄 Login attempt ${attempt} failed, retrying...`, 'warning');
        await sleep(2000);
      }
    }
    
    if (!loginSuccess) {
      log(`❌ Failed to login after 3 attempts`, 'error');
      return null;
    }
    
    const cardsAnswered = await this.processDeck().catch(e => {
      if (e.message === 'AUTH_EXPIRED') {
        log(`🔄 Token expired during deck, re-logging...`, 'warning');
        return this.login(account.privateKey, true).then(() => this.processDeck()).catch(() => 0);
      }
      log(`⚠️ Deck processing failed: ${e.message}`, 'warning');
      return 0;
    });
    
    const campaignsCompleted = await this.processCampaigns().catch(e => {
      if (e.message === 'AUTH_EXPIRED') {
        log(`🔄 Token expired during campaigns, re-logging...`, 'warning');
        return this.login(account.privateKey, true).then(() => this.processCampaigns()).catch(() => 0);
      }
      log(`⚠️ Campaigns failed: ${e.message}`, 'warning');
      return 0;
    });
    
    const badgesClaimed = await this.processBadges().catch(e => {
      if (e.message === 'AUTH_EXPIRED') {
        log(`🔄 Token expired during badges, re-logging...`, 'warning');
        return this.login(account.privateKey, true).then(() => this.processBadges()).catch(() => 0);
      }
      log(`⚠️ Badges failed: ${e.message}`, 'warning');
      return 0;
    });
    
    await this.processWellness().catch(e => {
      if (e.message === 'AUTH_EXPIRED') {
        log(`🔄 Token expired during wellness, re-logging...', 'warning');
        return this.login(account.privateKey, true).then(() => this.processWellness()).catch(() => {});
      }
      if (!e.message.includes('SERVER_ERROR') && !e.message.includes('GATEWAY_ERROR')) {
        log(`⚠️ Wellness failed: ${e.message}`, 'warning');
      }
    });
    
    await this.processStaking().catch(e => {
      if (e.message === 'AUTH_EXPIRED') {
        log(`🔄 Token expired during staking, re-logging...', 'warning');
        return this.login(account.privateKey, true).then(() => this.processStaking()).catch(() => {});
      }
      log(`⚠️ Staking failed: ${e.message}`, 'warning');
    });
    
    await this.logWater(250).catch(() => {});
    await this.logExercise(0).catch(() => {});
    await this.logSleep(0).catch(() => {});
    await this.logMeal().catch(() => {});
    await this.logMeditation(0).catch(() => {});
    await this.logMood().catch(() => {});
    await this.triageChat().catch(() => {});
    
    await this.fetchDeck().catch(() => {});
    
    const result = {
      address: this.address,
      balance: this.balance,
      earnedToday: this.earnedToday,
      cardsAnswered: this.dailyStats.totalCardsAnswered,
      campaignsCompleted: this.dailyStats.totalCampaignsCompleted,
      badgesClaimed: this.dailyStats.badgesClaimed,
      totalEarned: this.totalEarned,
      aiAnswers: this.dailyStats.aiAnswers,
      aiAttempts: this.dailyStats.aiAttempts,
      exerciseMinutes: this.dailyStats.exerciseMinutes,
      sleepHours: this.dailyStats.sleepHours,
      mealsLogged: this.dailyStats.mealsLogged,
      meditationMinutes: this.dailyStats.meditationMinutes,
      triageChats: this.dailyStats.triageChats,
      waterMl: this.dailyStats.waterMl,
      moodLogged: this.dailyStats.moodLogged,
      wellnessGoalsCompleted: this.dailyStats.wellnessGoalsCompleted,
      stakesPlaced: this.dailyStats.stakesPlaced,
      stakesWon: this.dailyStats.stakesWon,
      stakesLost: this.dailyStats.stakesLost,
    };
    
    logBanner(`✅ Account Complete!`);
    log(`💰 Balance: ${formatNumber(this.balance)} HP`, 'coin');
    log(`💫 Earned: ${formatNumber(this.totalEarned)} HP`, 'success');
    log(`📚 Cards: ${this.dailyStats.totalCardsAnswered}`, 'info');
    log(`🏥 Campaigns: ${this.dailyStats.totalCampaignsCompleted}`, 'info');
    log(`🏅 Badges: ${this.dailyStats.badgesClaimed}`, 'badge');
    log(`💪 Wellness: ${this.dailyStats.wellnessGoalsCompleted}`, 'wellness');
    log(`💧 Water: ${this.dailyStats.waterMl}ml`, 'water');
    log(`😊 Mood: ${this.dailyStats.moodLogged ? '✅' : '❌'}`, 'mood');
    log(`🎯 Stakes: ${this.dailyStats.stakesWon} won, ${this.dailyStats.stakesLost} lost`, 'stake');
    if (this.dailyStats.aiAnswers > 0) {
      log(`🧠 AI: ${this.dailyStats.aiAnswers} answers`, 'info');
    }
    
    this.dailyStats.totalHP += this.balance;
    
    return result;
  }

  async run() {
    const grandTotal = {
      accountsProcessed: 0,
      totalHP: 0,
      totalCardsAnswered: 0,
      totalCampaignsCompleted: 0,
      badgesClaimed: 0,
      wellnessGoalsCompleted: 0,
      mealsLogged: 0,
      exerciseMinutes: 0,
      sleepHours: 0,
      meditationMinutes: 0,
      triageChats: 0,
      waterMl: 0,
      moodLogged: 0,
      stakesPlaced: 0,
      stakesWon: 0,
      stakesLost: 0,
      aiAnswers: 0,
      aiAttempts: 0,
    };
    
    while (true) {
      const accounts = parseAccounts();
      if (accounts.length === 0) {
        log('❌ No accounts found in accounts.txt', 'error');
        return;
      }
      
      log(`📋 Found ${accounts.length} accounts`, 'info');
      
      const allResults = [];
      let successful = 0;
      
      const runStats = {
        totalHP: 0,
        totalCardsAnswered: 0,
        totalCampaignsCompleted: 0,
        badgesClaimed: 0,
        wellnessGoalsCompleted: 0,
        mealsLogged: 0,
        exerciseMinutes: 0,
        sleepHours: 0,
        meditationMinutes: 0,
        triageChats: 0,
        waterMl: 0,
        moodLogged: 0,
        stakesPlaced: 0,
        stakesWon: 0,
        stakesLost: 0,
        aiAnswers: 0,
        aiAttempts: 0,
      };
      
      for (let i = 0; i < accounts.length; i++) {
        log(`\n📌 Processing ${i + 1}/${accounts.length}`, 'highlight');
        
        const bot = new SaviorOfHealthBot(this.useProxy);
        const result = await bot.processAccount(accounts[i]);
        
        if (result) {
          successful++;
          allResults.push(result);
          
          runStats.totalHP += result.balance || 0;
          runStats.totalCardsAnswered += result.cardsAnswered || 0;
          runStats.totalCampaignsCompleted += result.campaignsCompleted || 0;
          runStats.badgesClaimed += result.badgesClaimed || 0;
          runStats.wellnessGoalsCompleted += result.wellnessGoalsCompleted || 0;
          runStats.mealsLogged += result.mealsLogged || 0;
          runStats.exerciseMinutes += result.exerciseMinutes || 0;
          runStats.sleepHours += result.sleepHours || 0;
          runStats.meditationMinutes += result.meditationMinutes || 0;
          runStats.triageChats += result.triageChats || 0;
          runStats.waterMl += result.waterMl || 0;
          runStats.moodLogged += result.moodLogged ? 1 : 0;
          runStats.stakesPlaced += result.stakesPlaced || 0;
          runStats.stakesWon += result.stakesWon || 0;
          runStats.stakesLost += result.stakesLost || 0;
          runStats.aiAnswers += result.aiAnswers || 0;
          runStats.aiAttempts += result.aiAttempts || 0;
          
          grandTotal.accountsProcessed++;
          grandTotal.totalHP += result.balance || 0;
          grandTotal.totalCardsAnswered += result.cardsAnswered || 0;
          grandTotal.totalCampaignsCompleted += result.campaignsCompleted || 0;
          grandTotal.badgesClaimed += result.badgesClaimed || 0;
          grandTotal.wellnessGoalsCompleted += result.wellnessGoalsCompleted || 0;
          grandTotal.mealsLogged += result.mealsLogged || 0;
          grandTotal.exerciseMinutes += result.exerciseMinutes || 0;
          grandTotal.sleepHours += result.sleepHours || 0;
          grandTotal.meditationMinutes += result.meditationMinutes || 0;
          grandTotal.triageChats += result.triageChats || 0;
          grandTotal.waterMl += result.waterMl || 0;
          grandTotal.moodLogged += result.moodLogged ? 1 : 0;
          grandTotal.stakesPlaced += result.stakesPlaced || 0;
          grandTotal.stakesWon += result.stakesWon || 0;
          grandTotal.stakesLost += result.stakesLost || 0;
          grandTotal.aiAnswers += result.aiAnswers || 0;
          grandTotal.aiAttempts += result.aiAttempts || 0;
          
          saveResults({
            timestamp: new Date().toISOString(),
            totalAccounts: accounts.length,
            successful: successful,
            results: allResults,
            grandTotal: grandTotal,
            runStats: runStats
          });
        }
        
        if (i < accounts.length - 1) {
          const waitTime = randomDelay(CONFIG.delayBetweenAccounts, CONFIG.delayBetweenAccounts + 3000);
          log(`💤 Waiting ${Math.round(waitTime/1000)}s before next account...`, 'sleep');
          await sleep(waitTime);
        }
      }
      
      logBanner('📊 FINAL SUMMARY');
      log(`✅ Successful: ${successful}/${accounts.length}`, 'success');
      log(`💰 Total HP: ${formatNumber(runStats.totalHP)}`, 'coin');
      log(`📚 Cards answered: ${runStats.totalCardsAnswered}`, 'info');
      log(`🏥 Campaigns completed: ${runStats.totalCampaignsCompleted}`, 'info');
      log(`🏅 Badges claimed: ${runStats.badgesClaimed}`, 'badge');
      log(`💪 Wellness goals: ${runStats.wellnessGoalsCompleted}`, 'wellness');
      log(`🍎 Meals logged: ${runStats.mealsLogged}`, 'nutrition');
      log(`🏃 Exercise minutes: ${runStats.exerciseMinutes}`, 'wellness');
      log(`😴 Sleep hours: ${runStats.sleepHours.toFixed(1)}`, 'wellness');
      log(`🧘 Meditation minutes: ${runStats.meditationMinutes}`, 'mind');
      log(`💬 Triage chats: ${runStats.triageChats}`, 'triage');
      log(`💧 Water: ${runStats.waterMl}ml`, 'water');
      log(`😊 Mood logged: ${runStats.moodLogged} times`, 'mood');
      log(`🎯 Stakes: ${runStats.stakesPlaced} placed, ${runStats.stakesWon} won, ${runStats.stakesLost} lost`, 'stake');
      if (runStats.aiAnswers > 0) {
        log(`🧠 AI answers: ${runStats.aiAnswers} (${runStats.aiAttempts} attempts)`, 'info');
      }
      log(`🔌 Proxy: ${this.useProxy ? 'Enabled' : 'Disabled'}`, 'proxy');
      
      if (allResults.length > 0) {
        log('\n📋 Account Results:', 'info');
        for (const result of allResults) {
          const shortAddr = result.address ? 
            `${result.address.substring(0, 8)}...${result.address.substring(result.address.length - 6)}` : 
            'unknown';
          log(`  ${shortAddr}: ${formatNumber(result.balance)} HP (Cards: ${result.cardsAnswered || 0}, Campaigns: ${result.campaignsCompleted || 0})`, 'info');
        }
      }
      
      if (CONFIG.sleepUntilNextDay) {
        const timeUntil = getTimeUntilNextDay();
        const hours = Math.floor(timeUntil / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        
        logBanner(`💤 Sleeping until next day`);
        log(`⏰ ${hours}h ${minutes}m until daily reset`, 'sleep');
        log(`📅 Next run at: ${new Date(Date.now() + timeUntil).toLocaleString()}`, 'sleep');
        
        const intervalMs = CONFIG.checkIntervalMinutes * 60 * 1000;
        let remaining = timeUntil;
        
        while (remaining > 0) {
          const sleepTime = Math.min(remaining, intervalMs);
          await sleep(sleepTime);
          remaining -= sleepTime;
          
          if (remaining > 0) {
            const remainingHours = Math.floor(remaining / (1000 * 60 * 60));
            const remainingMin = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            log(`⏳ ${remainingHours}h ${remainingMin}m remaining...`, 'sleep');
          }
        }
        
        log(`🌅 New day started!`, 'success');
        await sleep(randomDelay(1000, 5000));
      }
    }
  }
}

function showMenu() {
  console.log(`\n${COLORS.brightCyan}${'═'.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.brightYellow}  SAVIOROFHEALTH BOT MENU  ${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}${'═'.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.brightGreen}  1.${COLORS.reset} Run without proxy (Direct connection)`);
  console.log(`${COLORS.brightYellow}  2.${COLORS.reset} Run with proxy (Load from proxy.txt)`);
  console.log(`${COLORS.brightRed}  3.${COLORS.reset} Exit`);
  console.log(`${COLORS.brightCyan}${'═'.repeat(60)}${COLORS.reset}`);
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, answer => {
    rl.close();
    resolve(answer);
  }));
}

async function main() {
  while (true) {
    showMenu();
    const choice = await askQuestion(`${COLORS.brightCyan}Enter your choice (1-3): ${COLORS.reset}`);
    
    if (choice === '1') {
      logBanner('🚀 Starting bot without proxy...');
      const bot = new SaviorOfHealthBot(false);
      await bot.run();
      break;
    } else if (choice === '2') {
      logBanner('🚀 Starting bot with proxy...');
      const bot = new SaviorOfHealthBot(true);
      await bot.run();
      break;
    } else if (choice === '3') {
      log('👋 Exiting...', 'info');
      process.exit(0);
    } else {
      log('❌ Invalid choice. Please enter 1, 2, or 3.', 'error');
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    log(`❌ Fatal error: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = SaviorOfHealthBot;