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
    claimBadges: true,
    syncBadges: true,
    minBnbBalance: 0.0005,
    processDeck: true,
    processCampaigns: true,
    processWellness: true,
    processNutrition: true,
    processMindspace: true,
    processTriage: true,
    processAgents: true,
    processDailyCheckin: true,
    processDailyQuiz: true,
    processPulse: true,
    processReferral: true,
    completeProfile: true,
    processMissions: true,
    stakeGoals: true,
    stakeAmount: 10,
    autoStake: true,
    useGroqAI: true,
    maxCardsPerDay: 10,
    delayBetweenAccounts: 5000,
    delayBetweenRequests: 2000,
    groqTimeout: 10000,
    groqModels: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
    bscRpc: 'https://bsc-dataseed.binance.org/',
    badgeContract: '0xe0ad72abadf8ea43dd2e168bd97a24f8a04ada91',
    chainId: 56,
    apiUrl: 'https://saviorofhealth.app',
    sleepUntilNextDay: true,
    checkIntervalMinutes: 5,
    maxRetries: 3,
    retryDelay: 3000,
    skipOnServerError: true,
    requestTimeout: 60000,
  };

  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log('Created config.json with default settings');
    return defaultConfig;
  }

  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return { ...defaultConfig, ...config };
  } catch (error) {
    console.log('Error loading config.json, using defaults');
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
  brightBlue: '\x1b[94m',
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
    proxy: { color: COLORS.brightYellow, icon: '🔌' },
    skip: { color: COLORS.brightYellow, icon: '⏭️' },
    agent: { color: COLORS.brightMagenta, icon: '🤖' },
    stake: { color: COLORS.brightYellow, icon: '🎯' },
  };
  const style = styles[type] || styles.info;
  const prefix = `${style.color}${style.icon}${COLORS.reset}`;
  const msg = `${style.color}${message}${COLORS.reset}`;
  if (data) console.log(`${prefix} ${msg}\n${COLORS.gray}${JSON.stringify(data, null, 2)}${COLORS.reset}`);
  else console.log(`${prefix} ${msg}`);
}

function logBanner(message) {
  console.log(`\n${COLORS.brightCyan}${'='.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.brightYellow}  ${message}  ${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}${'='.repeat(60)}${COLORS.reset}\n`);
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
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
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
    log('Failed to save results: ' + error.message, 'warning');
  }
}

function generateSIWEMessage(address, chainId) {
  const nonce = Math.random().toString(36).substring(2, 18);
  return [
    'saviorofhealth wants you to sign in with your wallet.',
    '',
    'Address: ' + address,
    'Chain ID: ' + (chainId || 56),
    'Nonce: ' + nonce,
    'Issued At: ' + Date.now(),
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

function getRank(hp) {
  const ranks = [
    { min: 0, name: 'Dormant', color: '#9CB3A0' },
    { min: 2500, name: 'Awake', color: '#38BDF8' },
    { min: 5000, name: 'Vital', color: '#3DE68C' },
    { min: 12000, name: 'Radiant', color: '#A78BFA' },
    { min: 30000, name: 'Savior', color: '#EAB308' },
  ];
  let current = ranks[0];
  for (const rank of ranks) {
    if (hp >= rank.min) current = rank;
  }
  const next = ranks.find(r => r.min > hp);
  return { current, next };
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
          log('Loaded ' + this.proxies.length + ' proxies', 'success');
          return true;
        }
      }
      log('No proxies found, running without proxy', 'warning');
      return false;
    } catch (error) {
      log('Failed to load proxies: ' + error.message, 'warning');
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
        let url = 'socks5://';
        if (proxy.username && proxy.password) url += proxy.username + ':' + proxy.password + '@';
        url += proxy.host + ':' + proxy.port;
        return new SocksProxyAgent(url);
      } else {
        let url = 'http://';
        if (proxy.username && proxy.password) url += proxy.username + ':' + proxy.password + '@';
        url += proxy.host + ':' + proxy.port;
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
    this.models = CONFIG.groqModels || ['qwen/qwen3.6-27b', 'openai/gpt-oss-20b', 'groq/compound'];
    this.failedKeys = new Set();
    this.rateLimitedKeys = new Set();
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
          }
        }
        if (this.apiKeys.length > 0) {
          log('Loaded ' + this.apiKeys.length + ' Groq API keys', 'success');
          return true;
        }
      }
      log('No Groq API keys found in groq.txt', 'warning');
      return false;
    } catch (error) {
      log('Failed to load Groq API keys: ' + error.message, 'warning');
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
    if (this.models.length === 0) return null;
    return this.models[this.currentModelIndex] || this.models[0];
  }

  rotateKey() {
    if (this.apiKeys.length === 0) return null;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    log('Rotated API key', 'rotate');
    return this.apiKeys[this.currentKeyIndex];
  }

  async ask(question, options = null, proxyManager = null) {
    if (this.apiKeys.length === 0 || !CONFIG.useGroqAI) {
      return options ? options[Math.floor(Math.random() * options.length)] : 'I feel good today.';
    }

    let attempts = 0;
    const maxAttempts = Math.max(this.apiKeys.length * 2, 3);

    while (attempts < maxAttempts) {
      const key = this.getCurrentKey();
      const model = this.getCurrentModel();
      
      if (!key) {
        return options ? options[Math.floor(Math.random() * options.length)] : 'I feel good today.';
      }

      try {
        const prompt = "You are answering health survey questions. Answer naturally and concisely.\n\nQuestion: " + question + "\n" + (options ? "Options: " + options.join(", ") : "") + "\n\n" + (options ? "Respond with ONLY the option text you choose, nothing else." : "Give a 1-3 word honest response.");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.groqTimeout || 10000);

        const fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key,
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
          await sleep(20000 + Math.random() * 10000);
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
          if (data.error.message && (data.error.message.includes('rate') || data.error.message.includes('quota'))) {
            this.markKeyRateLimited(key);
          } else {
            this.rotateKey();
          }
          await sleep(1000);
        }

      } catch (error) {
        if (error.name === 'AbortError') {
          log('Groq request timeout (' + CONFIG.groqTimeout + 'ms)', 'warning');
          this.rotateKey();
        } else {
          log('Groq request error: ' + error.message, 'warning');
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
    this.maxRequestsPerSecond = 3;
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
      await sleep(randomDelay(800, 1600));
    }
    this.lastRequestTime = now;

    const url = CONFIG.apiUrl + endpoint;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
      'Accept': 'application/json',
      ...options.headers
    };
    
    if (this.token) {
      headers['Authorization'] = 'Bearer ' + this.token;
    }

    const fetchOptions = { 
      ...options, 
      headers,
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

      if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      }

      if (response.status === 504 || response.status === 502 || response.status === 503) {
        throw new Error('GATEWAY_ERROR');
      }

      if (response.status === 500) {
        throw new Error('SERVER_ERROR');
      }

      const text = await response.text();

      if (!text || text.trim() === '') {
        throw new Error('Empty response from server');
      }

      if (!contentType.includes('application/json')) {
        if (text.includes('<html') || text.includes('<!DOCTYPE')) {
          throw new Error('HTML response received (status ' + response.status + ')');
        }
        throw new Error('Non-JSON response: ' + text.substring(0, 100));
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid JSON: ' + text.substring(0, 100));
      }

      if (!response.ok) {
        throw new Error(data.error && data.error.message ? data.error.message : data.message || 'HTTP ' + response.status);
      }

      await sleep(randomDelay(300, 700));
      return data;

    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message === 'RATE_LIMITED') throw error;
      if (error.message === 'GATEWAY_ERROR') throw error;
      if (error.message === 'SERVER_ERROR') throw error;
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async requestWithRetry(endpoint, options = {}, maxRetries = CONFIG.maxRetries || 3) {
    let lastError;
    let retryDelay = CONFIG.retryDelay || 3000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;
        
        if (error.message === 'AUTH_EXPIRED') throw error;
        if (error.message === 'RATE_LIMITED') {
          const delay = retryDelay * Math.pow(2, attempt - 1) + Math.random() * 5000;
          log('Rate limited, waiting ' + Math.round(delay/1000) + 's...', 'warning');
          await sleep(delay);
          continue;
        }
        if (error.message.includes('400') || error.message.includes('422') || error.message.includes('409')) {
          throw error;
        }
        
        if ((error.message === 'SERVER_ERROR' || error.message === 'GATEWAY_ERROR') && CONFIG.skipOnServerError) {
          log('Server/gateway error, skipping this request', 'skip');
          return null;
        }
        
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(1.5, attempt - 1) + Math.random() * 1000;
          log('Retry ' + attempt + '/' + maxRetries + ' for ' + endpoint + ' in ' + Math.round(delay/1000) + 's...', 'warning');
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
    this.contractAddress = CONFIG.badgeContract || '0xe0ad72abadf8ea43dd2e168bd97a24f8a04ada91';
  }

  async init() {
    try {
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
      this.contract = new ethers.Contract(this.contractAddress, abi, this.wallet);
      
      return true;
    } catch (error) {
      log('BadgeClaimer init failed: ' + error.message, 'error');
      return false;
    }
  }

  async getBalance() {
    try {
      return await this.provider.getBalance(this.wallet.address);
    } catch (error) {
      return 0n;
    }
  }

  async hasClaimedOnChain(badgeKey) {
    try {
      return await this.contract.hasClaimed(this.wallet.address, badgeKey);
    } catch (e) {
      return false;
    }
  }

  async claimBadge(badgeKey, signature) {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || 5000000000n;
      
      const tx = await this.contract.claim(badgeKey, signature, {
        gasLimit: 500000,
        gasPrice: gasPrice,
      });
      
      const receipt = await tx.wait(2);
      
      if (receipt.status === 1) {
        return receipt.transactionHash;
      }
      return null;
    } catch (error) {
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
    this.provider = null;
    this.privateKey = null;
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
    this.referralLink = null;
    this.rank = null;
    this._referralBonus = 0;
    this.answeredQuestions = new Set();
    this.dailyStats = {
      accountsProcessed: 0,
      totalHP: 0,
      totalCardsAnswered: 0,
      totalCampaignsCompleted: 0,
      badgesClaimed: 0,
      badgesSynced: 0,
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
      agentChats: 0,
      agentRewards: 0,
      dailyCheckinClaimed: false,
      quizCompleted: false,
      pulseAnswered: false,
      profileCompleted: false,
      referralGenerated: false,
      missionsClaimed: 0,
      missionsReward: 0,
    };
  }

  async login(privateKey, forceRefresh = false) {
    try {
      if (!forceRefresh && this.apiClient.token && !this.apiClient.isTokenExpired()) {
        return true;
      }

      const pk = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
      this.privateKey = pk;
      
      if (!this.provider) {
        this.provider = new ethers.JsonRpcProvider(CONFIG.bscRpc);
      }
      
      this.wallet = new ethers.Wallet(pk, this.provider);
      this.address = this.wallet.address;
      
      const shortAddr = this.address.substring(0, 8) + '...' + this.address.substring(this.address.length - 6);
      log('Key ' + shortAddr, 'info');
      
      let chainId = CONFIG.chainId || 56;
      
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
      this.balance = response.user && response.user.tokenBalance ? response.user.tokenBalance : 0;
      this.chainId = chainId;
      
      log('Authenticated (Chain: ' + chainId + ')', 'success');
      return true;
      
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') {
        log('Token expired, re-authenticating...', 'warning');
        return this.login(privateKey, true);
      }
      log('Auth failed: ' + error.message, 'error');
      return false;
    }
  }

  async applyReferralIfNeeded() {
    try {
      const ref = await this.apiClient.request('/api/referral', { method: 'GET' });
      if (ref && ref.code) {
        return;
      }
      const REFERRAL_CODE = 'K33MUPP8';
      const result = await this.apiClient.request('/api/referral/apply', {
        method: 'POST',
        body: JSON.stringify({ code: REFERRAL_CODE })
      });
      if (result && result.ok) {
        if (result.reward) {
          this.balance = result.balance || this.balance;
          this.totalEarned += result.reward;
          this._referralBonus = result.reward;
        }
      }
    } catch (error) {
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
      log('Failed to fetch deck: ' + error.message, 'error');
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
      if (card && card.question) {
        this.answeredQuestions.add(card.question.substring(0, 50));
      }
      
      this.totalEarned += data.reward || 0;
      this.dailyStats.totalCardsAnswered++;
      
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message === 'RATE_LIMITED') {
        log('  Rate limited, skipping card', 'warning');
        const card = this.cards.find(c => c.id === cardId);
        if (card) card.answered = true;
        return { ok: true, reward: 0, skipped: true };
      }
      
      if ((error.message === 'SERVER_ERROR' || error.message === 'GATEWAY_ERROR') && CONFIG.skipOnServerError) {
        log('  Server/gateway error, skipping this card', 'skip');
        const card = this.cards.find(c => c.id === cardId);
        if (card) card.answered = true;
        return { ok: true, reward: 0, skipped: true };
      }
      
      if (error.message.includes('Empty response') || error.message.includes('Invalid JSON') || error.message.includes('HTML response')) {
        log('  Invalid response. Skipping card.', 'warning');
        const card = this.cards.find(c => c.id === cardId);
        if (card) card.answered = true;
        return { ok: true, reward: 0, skipped: true };
      }
      
      log('  Failed to answer card: ' + error.message, 'error');
      const card = this.cards.find(c => c.id === cardId);
      if (card) card.answered = true;
      return null;
    }
  }

  async processDeck() {
    if (!CONFIG.processDeck) {
      log('Deck processing disabled', 'warning');
      return 0;
    }

    logBanner('Processing Daily Deck');
    
    let cardCount = 0;
    let attempts = 0;
    const maxAttempts = CONFIG.maxCardsPerDay || 10;
    let consecutiveFailures = 0;
    let serverErrorCount = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      await this.fetchDeck();
      
      const unanswered = this.cards.filter(card => {
        if (card.answered) return false;
        const questionKey = card.question ? card.question.substring(0, 50) : card.id;
        if (this.answeredQuestions.has(questionKey)) {
          log('  Skipping duplicate question: ' + questionKey.substring(0, 30) + '...', 'skip');
          return false;
        }
        return true;
      });
      
      if (unanswered.length === 0) break;
      
      const card = unanswered[0];
      cardCount++;
      
      const preview = card.question ? card.question.substring(0, 35) : 'Question';
      log('' + cardCount + '/' + this.cards.length + ': ' + preview + '...', 'info');
      
      let answer = null;
      let guess = null;
      
      if (CONFIG.useGroqAI && this.groq.apiKeys.length > 0) {
        this.dailyStats.aiAttempts++;
        
        // Wait before each Groq request to avoid rate limits
        await sleep(8000 + Math.random() * 4000);
        
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
        // Wait after successful request to let rate limit reset
        await sleep(2000 + Math.random() * 3000);
        log('  Answer: ' + answer, 'debug');
        if (guess) log('  Guess: ' + guess + '%', 'debug');
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
      
      try {
        const result = await this.answerCard(card.id, answer, guess);
        
        if (result && result.ok !== false) {
          consecutiveFailures = 0;
          serverErrorCount = 0;
          if (result.reward) {
            log('  +' + result.reward + ' HP (Balance: ' + formatNumber(this.balance) + ')', 'success');
            if (result.accuracy !== undefined && result.accuracy !== null) {
              log('  Accuracy: ' + result.accuracy + '%', 'debug');
            }
          }
        } else {
          consecutiveFailures++;
          serverErrorCount++;
          log('  Failed to answer card (' + consecutiveFailures + ' consecutive failures)', 'warning');
          
          if (serverErrorCount >= 5) {
            log('  Too many server errors (' + serverErrorCount + '), stopping deck processing', 'error');
            break;
          }
          
          if (consecutiveFailures >= 3) {
            log('  Too many failures, skipping remaining cards', 'error');
            break;
          }
        }
      } catch (error) {
        if (error.message === 'AUTH_EXPIRED') throw error;
        if (error.message === 'RATE_LIMITED') {
          log('  Rate limit hit, skipping remaining cards', 'warning');
          break;
        }
        log('  Failed to answer card: ' + error.message, 'error');
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          log('  Too many failures, skipping remaining cards', 'error');
          break;
        }
      }
      
      await sleep(randomDelay(3000, 6000));
    }
    
    if (cardCount > 0) {
      log('Completed ' + cardCount + ' cards', 'success');
    } else {
      log('No new cards available', 'info');
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
      log('Failed to fetch campaigns: ' + error.message, 'error');
      return null;
    }
  }

  async processCampaigns() {
    if (!CONFIG.processCampaigns) {
      log('Campaign processing disabled', 'warning');
      return 0;
    }

    logBanner('Processing Clinic Campaigns');
    
    await this.fetchCampaigns();
    
    const activeCampaigns = this.campaigns.filter(campaign => {
      if (!campaign.items || campaign.items.length === 0) return false;
      return campaign.items.some(item => !item.answered);
    });
    
    if (activeCampaigns.length === 0) {
      log('No active campaigns', 'info');
      return 0;
    }
    
    let completed = 0;
    let totalReward = 0;
    let serverErrorCount = 0;
    
    for (const campaign of activeCampaigns) {
      if (serverErrorCount >= 3) {
        log('Too many server errors, stopping campaigns', 'error');
        break;
      }
      
      const title = campaign.title ? campaign.title.substring(0, 35) : campaign.key || 'Campaign';
      log('' + title + '...', 'info');
      
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
            
            // Wait before each Groq request to avoid rate limits
            await sleep(8000 + Math.random() * 4000);
            
            if (currentAsk.kind === 'text') {
              answer = await this.groq.ask(currentAsk.options && currentAsk.options[0] ? currentAsk.options[0] : 'How are you?', null, this.proxyManager);
              if (!answer) answer = 'I feel healthy today.';
            } else if (currentAsk.kind === 'multi') {
              const shuffled = [...currentAsk.options].sort(() => Math.random() - 0.5);
              const count = 1 + Math.floor(Math.random() * Math.min(2, currentAsk.options.length - 1));
              answer = shuffled.slice(0, count);
            } else {
              answer = await this.groq.ask(currentAsk.options && currentAsk.options[0] ? currentAsk.options[0] : 'How are you?', currentAsk.options, this.proxyManager);
              if (!answer) answer = currentAsk.options[Math.floor(Math.random() * currentAsk.options.length)];
            }
            this.dailyStats.aiAnswers++;
          } else {
            if (currentAsk.kind === 'text') {
              answer = 'I feel healthy today.';
            } else if (currentAsk.kind === 'multi') {
              const shuffled = [...currentAsk.options].sort(() => Math.random() - 0.5);
              const count = 1 + Math.floor(Math.random() * Math.min(2, currentAsk.options.length - 1));
              answer = shuffled.slice(0, count);
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
            log('  +' + response.reward + ' HP', 'success');
          }
          
          currentAsk = response && response.ask ? response.ask : null;
          await sleep(randomDelay(800, 2000));
        }
        
        completed++;
        this.completedCampaigns.push(campaign.key);
        
        if (campaignReward > 0) {
          log('+ ' + campaignReward + ' HP from campaign', 'success');
          totalReward += campaignReward;
        }
        
      } catch (error) {
        if (error.message === 'AUTH_EXPIRED') throw error;
        if (error.message === 'SERVER_ERROR' || error.message === 'GATEWAY_ERROR') {
          serverErrorCount++;
          log('Server/gateway error on campaign (' + serverErrorCount + '/3)', 'warning');
        } else {
          log('Campaign failed: ' + error.message, 'error');
        }
      }
      
      await sleep(randomDelay(3000, 5000));
    }
    
    if (completed > 0) {
      log('Completed ' + completed + ' campaigns (' + totalReward + ' HP)', 'success');
    }
    
    return completed;
  }

  async fetchBadges() {
    try {
      const data = await this.apiClient.requestWithRetry('/api/badges', { method: 'GET' });
      this.badges = data.badges || [];
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      log('Failed to fetch badges: ' + error.message, 'error');
      return null;
    }
  }

  async getBadgeTxHashFromEvents(badgeKey) {
    try {
      const provider = new ethers.JsonRpcProvider(CONFIG.bscRpc);
      const contract = new ethers.Contract(
        CONFIG.badgeContract,
        ['event Claimed(address indexed wallet, string badgeKey, uint256 reward, uint256 timestamp)'],
        provider
      );
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = currentBlock - 50000;
      const filter = contract.filters.Claimed(this.address, badgeKey);
      const events = await contract.queryFilter(filter, fromBlock, currentBlock);
      if (events.length > 0) {
        return events[events.length - 1].transactionHash;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async syncBadgeToServer(badgeKey, txHash) {
    try {
      const result = await this.apiClient.requestWithRetry('/api/badges/sbt/confirm', {
        method: 'POST',
        body: JSON.stringify({ badgeKey, txHash })
      });
      return result && result.ok;
    } catch (e) {
      return false;
    }
  }

  async processBadges() {
    const shouldMint = CONFIG.claimBadges === true;
    const shouldSync = CONFIG.syncBadges === true;

    if (!shouldMint && !shouldSync) {
      log('Badge processing disabled (claimBadges=false, syncBadges=false)', 'warning');
      return 0;
    }

    logBanner('Processing Badges');
    
    await this.fetchBadges();
    
    if (!this.badges || this.badges.length === 0) {
      log('No badges data available', 'warning');
      return 0;
    }

    const toProcess = this.badges.filter(badge => badge.earned === true && badge.claimed === false);
    
    if (toProcess.length === 0) {
      log('All earned badges are already synced with API', 'info');
      return 0;
    }
    
    log('Found ' + toProcess.length + ' badges to process', 'info');
    
    const badgeClaimer = new BadgeClaimer(this.privateKey, this.proxyManager);
    if (!await badgeClaimer.init()) {
      log('Failed to initialize wallet for badge processing', 'error');
      return 0;
    }
    
    let minted = 0;
    let synced = 0;
    let totalReward = 0;
    
    for (const badge of toProcess) {
      log('  🏅 ' + badge.name + ' (+' + badge.reward + ' HP)', 'badge');
      
      let onChainClaimed = false;
      try {
        onChainClaimed = await badgeClaimer.hasClaimedOnChain(badge.key);
      } catch (e) {
        log('    Could not check on-chain: ' + e.message, 'warning');
      }
      
      if (onChainClaimed) {
        log('    Already claimed on-chain', 'sync');
        
        if (shouldSync) {
          let txHash = await this.getBadgeTxHashFromEvents(badge.key);
          if (!txHash) {
            log('    No tx hash found in events, cannot sync', 'warning');
            continue;
          }
          
          log('    Syncing with tx: ' + txHash.substring(0, 20) + '...', 'sync');
          const ok = await this.syncBadgeToServer(badge.key, txHash);
          if (ok) {
            synced++;
            totalReward += badge.reward || 0;
            this.dailyStats.badgesSynced++;
            this.totalEarned += badge.reward || 0;
            log('    ' + badge.name + ' synced! +' + badge.reward + ' HP', 'success');
          } else {
            log('    Failed to sync ' + badge.name, 'warning');
          }
        } else {
          log('    Sync disabled, skipping', 'info');
        }
      } else {
        log('    Not claimed on-chain yet', 'info');
        
        if (shouldMint) {
          const balance = await badgeClaimer.getBalance();
          const minBnb = ethers.parseEther(CONFIG.minBnbBalance.toString());
          if (balance < minBnb) {
            const bnbStr = ethers.formatEther(balance);
            log('    Insufficient BNB. Need ' + CONFIG.minBnbBalance + ' BNB (have ' + bnbStr + ' BNB)', 'warning');
            continue;
          }
          
          log('    Getting mint signature...', 'debug');
          const sigData = await this.apiClient.requestWithRetry('/api/badges/sbt', {
            method: 'POST',
            body: JSON.stringify({ badgeKey: badge.key })
          });
          
          if (!sigData || !sigData.signature) {
            log('    No signature received', 'error');
            continue;
          }
          
          log('    Minting on-chain...', 'mint');
          const txHash = await badgeClaimer.claimBadge(badge.key, sigData.signature);
          
          if (txHash) {
            const confirmOk = await this.syncBadgeToServer(badge.key, txHash);
            if (confirmOk) {
              minted++;
              totalReward += badge.reward || 0;
              this.dailyStats.badgesClaimed++;
              this.totalEarned += badge.reward || 0;
              log('    ' + badge.name + ' minted! +' + badge.reward + ' HP', 'success');
            } else {
              log('    Minted but failed to confirm with API', 'warning');
            }
          } else {
            log('    Mint transaction failed', 'error');
          }
        } else {
          log('    Minting disabled, skipping', 'info');
        }
      }
      
      await sleep(randomDelay(800, 1500));
    }
    
    if (minted > 0 || synced > 0) {
      try {
        const me = await this.apiClient.request('/api/auth/me', { method: 'GET' });
        if (me && me.user) {
          this.balance = me.user.tokenBalance || this.balance;
        }
      } catch (e) {}
      log('Minted: ' + minted + ', Synced: ' + synced + ' (' + totalReward + ' HP)', 'success');
    } else {
      log('No badges were minted or synced', 'info');
    }
    
    return minted + synced;
  }

  async fetchGoals() {
    try {
      const data = await this.apiClient.requestWithRetry('/api/goals', { method: 'GET' });
      this.goals = data;
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message === 'SERVER_ERROR' || error.message === 'GATEWAY_ERROR') {
        return null;
      }
      log('Failed to fetch goals: ' + error.message, 'error');
      return null;
    }
  }

  async logWater(ml) {
    try {
      const amount = Math.max(ml || 250, 250);
      const data = await this.apiClient.request('/api/logs/water', {
        method: 'POST',
        body: JSON.stringify({ amountMl: amount })
      });
      this.dailyStats.waterMl += amount;
      log('  Logged ' + amount + 'ml water', 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log('  Already logged water today', 'warning');
        return null;
      }
      if (error.message !== 'SERVER_ERROR' && error.message !== 'GATEWAY_ERROR') {
        log('  Failed to log water: ' + error.message, 'error');
      }
      return null;
    }
  }

  async logExercise(minutes) {
    try {
      const min = Math.max(minutes || 20, 10 + Math.floor(Math.random() * 30));
      const data = await this.apiClient.request('/api/logs/exercise', {
        method: 'POST',
        body: JSON.stringify({ 
          exerciseType: 'walking',
          durationMin: min
        })
      });
      this.dailyStats.exerciseMinutes += min;
      log('  Logged ' + min + 'min exercise', 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log('  Already logged exercise today', 'warning');
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
      wakeTime.setHours(bedtime.getHours() + Math.floor(h), bedtime.getMinutes() + Math.round((h % 1) * 60), 0, 0);
      
      const data = await this.apiClient.request('/api/logs/sleep', {
        method: 'POST',
        body: JSON.stringify({ 
          bedtime: bedtime.toISOString(),
          wakeTime: wakeTime.toISOString()
        })
      });
      this.dailyStats.sleepHours += h;
      log('  Logged ' + h.toFixed(1) + 'h sleep', 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log('  Already logged sleep today', 'warning');
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
      
      const data = await this.apiClient.request('/api/logs/meal', {
        method: 'POST',
        body: JSON.stringify({
          mealType: meal,
          description: food,
          calories: calories
        })
      });
      this.dailyStats.mealsLogged++;
      log('  Logged ' + meal + ': ' + food + ' (' + calories + ' cal)', 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log('  Already logged a meal today', 'warning');
        return null;
      }
      return null;
    }
  }

  async logMeditation(minutes) {
    if (!CONFIG.processMindspace) return null;
    
    try {
      const sessionTypes = ['guided', 'breathing', 'body_scan', 'free'];
      const min = Math.max(minutes || 5, 3 + Math.floor(Math.random() * 10));
      const type = sessionTypes[Math.floor(Math.random() * sessionTypes.length)];
      
      const data = await this.apiClient.request('/api/logs/meditation', {
        method: 'POST',
        body: JSON.stringify({ 
          durationMin: min,
          sessionType: type
        })
      });
      this.dailyStats.meditationMinutes += min;
      log('  Logged ' + min + 'min ' + type + ' meditation', 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log('  Already logged meditation today', 'warning');
        return null;
      }
      return null;
    }
  }

  async logMood(score) {
    try {
      const s = score || Math.floor(3 + Math.random() * 3);
      const data = await this.apiClient.request('/api/logs/mood', {
        method: 'POST',
        body: JSON.stringify({ score: s })
      });
      this.dailyStats.moodLogged = true;
      log('  Logged mood: ' + s + '/5', 'success');
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log('  Already logged mood today', 'warning');
        return null;
      }
      if (error.message !== 'SERVER_ERROR' && error.message !== 'GATEWAY_ERROR') {
        log('  Failed to log mood: ' + error.message, 'error');
      }
      return null;
    }
  }

  async triageChat() {
    if (!CONFIG.processTriage) {
      log('Triage processing disabled', 'warning');
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
      
      const data = await this.apiClient.request('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ 
          message: symptom,
          agentType: 'gatekeeper'
        })
      });
      
      this.dailyStats.triageChats++;
      
      if (data && data.reward && data.reward.awarded) {
        this.balance = data.balance || this.balance;
        this.totalEarned += data.reward.amount || 0;
        log('  +' + data.reward.amount + ' HP for triage chat', 'success');
      } else {
        log('  Triage chat completed', 'success');
      }
      
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('409')) {
        log('  Already completed triage today', 'warning');
        return null;
      }
      if (error.message !== 'SERVER_ERROR' && error.message !== 'GATEWAY_ERROR') {
        log('  Failed to triage chat: ' + error.message, 'error');
      }
      return null;
    }
  }

  async processDailyCheckin() {
    if (!CONFIG.processDailyCheckin) {
      return null;
    }
    try {
      const missions = await this.apiClient.request('/api/missions', { method: 'GET' });
      if (!missions || !missions.missions) return null;
      const checkinMission = missions.missions.find(m => m.key === 'daily-checkin');
      if (!checkinMission || checkinMission.completed || checkinMission.locked) return null;
      const result = await this.apiClient.request('/api/missions/daily-checkin/claim', {
        method: 'POST'
      });
      if (result && result.reward) {
        this.balance = result.balance || this.balance;
        this.totalEarned += result.reward;
        this.dailyStats.dailyCheckinClaimed = true;
        log('  +' + result.reward + ' HP daily check-in', 'checkin');
        return result;
      }
      return null;
    } catch (error) {
      if (error.message.includes('409')) {
        log('  Daily check-in already claimed', 'warning');
      }
      return null;
    }
  }

  async processDailyQuiz() {
    if (!CONFIG.processDailyQuiz) {
      return null;
    }
    try {
      const quiz = await this.apiClient.request('/api/quiz/today', { method: 'GET' });
      if (!quiz || quiz.done) return null;
      let answer;
      if (CONFIG.useGroqAI && this.groq.apiKeys.length > 0) {
        this.dailyStats.aiAttempts++;
        answer = await this.groq.ask(quiz.question, quiz.options, this.proxyManager);
        this.dailyStats.aiAnswers++;
        if (!answer) answer = quiz.options[Math.floor(Math.random() * quiz.options.length)];
      } else {
        answer = quiz.options[Math.floor(Math.random() * quiz.options.length)];
      }
      const result = await this.apiClient.request('/api/quiz/answer', {
        method: 'POST',
        body: JSON.stringify({ choice: answer })
      });
      if (result && result.correct) {
        this.balance = result.balance || this.balance;
        const reward = result.reward || quiz.reward || 0;
        this.totalEarned += reward;
        this.dailyStats.quizCompleted = true;
        log('  Quiz correct! +' + reward + ' HP', 'quiz');
        return result;
      }
      return null;
    } catch (error) {
      if (error.message.includes('409')) {
        log('  Quiz already completed', 'warning');
      }
      return null;
    }
  }

  async processPulse() {
    if (!CONFIG.processPulse) {
      return null;
    }
    try {
      const pulse = await this.apiClient.request('/api/pulse/today', { method: 'GET' });
      if (!pulse || pulse.answered || !pulse.survey) return null;
      let answer;
      let guess = Math.floor(25 + Math.random() * 50);
      if (CONFIG.useGroqAI && this.groq.apiKeys.length > 0) {
        this.dailyStats.aiAttempts++;
        answer = await this.groq.ask(pulse.survey.question, pulse.survey.options, this.proxyManager);
        this.dailyStats.aiAnswers++;
        if (!answer) answer = pulse.survey.options[Math.floor(Math.random() * pulse.survey.options.length)];
      } else {
        answer = pulse.survey.options[Math.floor(Math.random() * pulse.survey.options.length)];
      }
      const result = await this.apiClient.request('/api/pulse/answer', {
        method: 'POST',
        body: JSON.stringify({ answer: answer, crowdGuess: guess })
      });
      if (result && result.ok) {
        this.balance = result.balance || this.balance;
        const reward = result.reward || pulse.survey.reward || 0;
        this.totalEarned += reward;
        this.dailyStats.pulseAnswered = true;
        log('  Pulse answered! Guess: ' + guess + '% +' + reward + ' HP', 'pulse');
        return result;
      }
      return null;
    } catch (error) {
      if (error.message.includes('409')) {
        log('  Pulse already answered', 'warning');
      }
      return null;
    }
  }

  async processPulseReveal() {
    try {
      const result = await this.apiClient.request('/api/pulse/yesterday', { method: 'GET' });
      if (result && result.actualPct !== undefined) {
        log('  Yesterday\'s pulse: ' + result.actualPct + '% (you guessed ' + result.yourGuess + '%)', 'pulse');
        if (result.reward > 0) {
          this.balance = result.balance || this.balance;
          this.totalEarned += result.reward;
          log('  +' + result.reward + ' HP pulse bonus!', 'success');
        }
        return result;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async processReferral() {
    if (!CONFIG.processReferral) {
      return null;
    }
    try {
      const ref = await this.apiClient.request('/api/referral', { method: 'GET' });
      if (ref && ref.code) {
        this.referralLink = ref.link;
        if (ref.qualified > 0 && ref.newlyQualified > 0) {
          const reward = ref.newlyQualified * ref.rewardPerReferral;
          this.balance = ref.balance || this.balance;
          this.totalEarned += reward;
          log('  +' + reward + ' HP from ' + ref.newlyQualified + ' qualified referral(s)!', 'success');
        }
        return ref;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async completeProfile() {
    if (!CONFIG.completeProfile) {
      return null;
    }
    try {
      const me = await this.apiClient.request('/api/auth/me', { method: 'GET' });
      if (me.user && me.user.displayName) {
        return null;
      }
      const regions = ['North America', 'Latin America', 'Europe', 'Middle East & Africa', 'South Asia', 'East Asia', 'Southeast Asia', 'Oceania'];
      const names = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Avery', 'Quinn', 'Emerson'];
      const profile = {
        displayName: names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 1000),
        age: Math.floor(25 + Math.random() * 40),
        region: regions[Math.floor(Math.random() * regions.length)],
        heightCm: Math.floor(160 + Math.random() * 30),
        weightKg: Math.floor(60 + Math.random() * 40),
        chronicConditions: [],
        dataConsent: true
      };
      const result = await this.apiClient.request('/api/auth/profile', {
        method: 'POST',
        body: JSON.stringify(profile)
      });
      if (result && result.user) {
        this.balance = result.user.tokenBalance || this.balance;
        const bonus = 25;
        this.totalEarned += bonus;
        this.dailyStats.profileCompleted = true;
        log('  +' + bonus + ' HP profile completed!', 'profile');
        return result;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async processAllMissions() {
    if (!CONFIG.processMissions) {
      return 0;
    }
    try {
      const missions = await this.apiClient.request('/api/missions', { method: 'GET' });
      if (!missions || !missions.missions) return 0;
      let claimed = 0;
      let totalReward = 0;
      const skipKeys = ['follow-x', 'join-tg', 'rt-launch', 'quote-x'];
      for (const mission of missions.missions) {
        if (mission.completed || mission.locked || skipKeys.includes(mission.key) || !mission.eligible) {
          continue;
        }
        try {
          const result = await this.apiClient.request('/api/missions/' + mission.key + '/claim', {
            method: 'POST'
          });
          if (result && result.ok) {
            this.balance = result.balance || this.balance;
            this.totalEarned += mission.reward;
            claimed++;
            totalReward += mission.reward;
            log('  +' + mission.reward + ' HP: ' + mission.title, 'mission');
          }
        } catch (error) {
          if (error.message.includes('409')) {
          }
        }
        await sleep(randomDelay(500, 1200));
      }
      this.dailyStats.missionsClaimed = claimed;
      this.dailyStats.missionsReward = totalReward;
      if (claimed > 0) {
        log('Claimed ' + claimed + ' missions (' + totalReward + ' HP)', 'success');
      }
      return totalReward;
    } catch (error) {
      return 0;
    }
  }

  async trackRank() {
    try {
      const rank = getRank(this.balance);
      this.rank = rank;
      if (rank.current && rank.current.name) {
        log('  Rank: ' + rank.current.name + ' (' + formatNumber(this.balance) + ' HP)', 'rank');
        if (rank.next) {
          log('  Next rank: ' + rank.next.name + ' at ' + formatNumber(rank.next.min) + ' HP (' + formatNumber(rank.next.min - this.balance) + ' to go)', 'rank');
        }
      }
      return rank;
    } catch (error) {
      return null;
    }
  }

  async processWellnessLogging() {
    if (!CONFIG.processWellness) {
      return 0;
    }
    logBanner('Logging Wellness Activities');
    let completed = 0;
    await this.fetchGoals();
    if (this.goals && this.goals.today && this.goals.today.goals) {
      for (const goal of this.goals.today.goals) {
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
              case 'triage':
                await this.triageChat();
                break;
              default:
                break;
            }
          } catch (error) {
          }
          await sleep(randomDelay(800, 2000));
        }
      }
      await this.fetchGoals();
      if (this.goals && this.goals.today) {
        for (const goal of this.goals.today.goals) {
          if (goal.done && !goal._completed) {
            goal._completed = true;
            completed++;
            this.dailyStats.wellnessGoalsCompleted++;
          }
        }
      }
    }
    await this.logWater(250).catch(() => {});
    await this.logExercise(0).catch(() => {});
    await this.logSleep(0).catch(() => {});
    await this.logMeal().catch(() => {});
    await this.logMeditation(0).catch(() => {});
    await this.logMood().catch(() => {});
    await this.triageChat().catch(() => {});
    return completed;
  }

  getAgentConfigs() {
    return {
      nurse: {
        id: 'nurse',
        name: 'Nia',
        icon: '💪',
        questions: [
          'How is your energy this morning?',
          'Did you sleep well last night?',
          'How stressed are you today on a scale of 1-10?',
          'What is your mood like today?',
          'Have you been active today?'
        ],
      },
      gatekeeper: {
        id: 'gatekeeper',
        name: 'Atlas',
        icon: '💬',
        questions: [
          'I have a headache and fever',
          'My chest feels tight',
          'Which department should I visit?',
          'I have a sore throat for 3 days',
          'I feel dizzy and nauseous'
        ]
      },
      nutritionist: {
        id: 'nutritionist',
        name: 'Sage',
        icon: '🍎',
        questions: [
          'Plan a balanced lunch for me',
          'Is my diet healthy?',
          'I had chicken salad and rice',
          'What should I eat for dinner?',
          'Give me a healthy meal plan'
        ]
      },
      mindcare: {
        id: 'mindcare',
        name: 'Luna',
        icon: '🧘',
        questions: [
          'I\'m feeling stressed today',
          'Help me relax',
          'I can\'t focus',
          'I feel anxious',
          'Give me a mindfulness exercise'
        ]
      }
    };
  }

  async chatWithAgent(agentType, message) {
    try {
      const data = await this.apiClient.request('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: message,
          agentType: agentType
        })
      });
      
      if (data && data.response) {
        log('    ' + data.response.substring(0, 60) + '...', 'debug');
      }
      
      if (data && data.reward && data.reward.awarded) {
        this.balance = data.balance || this.balance;
        this.totalEarned += data.reward.amount || 0;
        this.dailyStats.agentRewards += data.reward.amount || 0;
        log('  ✅ +' + data.reward.amount + ' HP from ' + agentType + ' chat', 'success');
        return data;
      } else if (data && data.already) {
        log('  ⏭️ Already chatted with ' + agentType + ' today', 'skip');
        return null;
      } else {
        log('  ⏭️ No reward from ' + agentType + ' (already done today)', 'skip');
        return null;
      }
      
      this.dailyStats.agentChats++;
      
    } catch (error) {
      if (error.message.includes('409')) {
        log('  ⏭️ Already chatted with ' + agentType + ' today', 'skip');
      } else if (error.message === 'AUTH_EXPIRED') {
        throw error;
      } else {
        log('  ❌ Failed to chat with ' + agentType + ': ' + error.message, 'error');
      }
      return null;
    }
  }

  async processAgents() {
    if (!CONFIG.processAgents) {
      log('AI Agent processing disabled', 'warning');
      return 0;
    }
    
    logBanner('Processing AI Agents');
    const agents = this.getAgentConfigs();
    let totalReward = 0;
    let successCount = 0;
    
    for (const [type, config] of Object.entries(agents)) {
      const question = config.questions[Math.floor(Math.random() * config.questions.length)];
      log('  ' + config.icon + ' Talking to ' + config.name + ' (' + type + ')...', 'agent');
      
      const result = await this.chatWithAgent(type, question);
      if (result && result.reward && result.reward.awarded) {
        totalReward += result.reward.amount || 0;
        successCount++;
      }
      
      await sleep(randomDelay(2000, 4000));
    }
    
    if (successCount > 0) {
      log('✅ Completed ' + successCount + ' AI agent chats (' + totalReward + ' HP)', 'success');
    } else {
      log('ℹ️ All agent chats already done today (0 HP)', 'info');
    }
    
    return totalReward;
  }

  async fetchStakeGoals() {
    try {
      const data = await this.apiClient.request('/api/stake', { method: 'GET' });
      this.stakeGoals = data;
      return data;
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') throw error;
      if (error.message.includes('400') || error.message.includes('409')) {
        return null;
      }
      return null;
    }
  }

  async placeStake(goalKey, amount, label) {
    try {
      const data = await this.apiClient.request('/api/stake', {
        method: 'POST',
        body: JSON.stringify({ 
          goalKey: goalKey,
          amount: amount,
          label: label || goalKey
        })
      });
      this.dailyStats.stakesPlaced++;
      if (data && data.balance) this.balance = data.balance;
      log('  Staked ' + amount + ' HP on ' + (label || goalKey), 'stake');
      return data;
    } catch (error) {
      if (error.message.includes('409')) {
        log('  Already staked on ' + goalKey + ' today', 'warning');
      } else if (error.message.includes('400')) {
        log('  Goal not ready for staking yet', 'warning');
      } else if (error.message !== 'SERVER_ERROR' && error.message !== 'GATEWAY_ERROR') {
        log('  Failed to stake on ' + goalKey + ': ' + error.message, 'error');
      }
      return null;
    }
  }

  async processStaking() {
    if (!CONFIG.stakeGoals) {
      return 0;
    }
    logBanner('Processing Staking');
    await this.fetchStakeGoals();
    if (!this.stakeGoals) {
      log('  No staking data available', 'warning');
      return 0;
    }
    if (this.stakeGoals.history) {
      const wonStakes = this.stakeGoals.history.filter(s => s.status === 'won' && !s._claimed);
      for (const stake of wonStakes) {
        stake._claimed = true;
        this.dailyStats.stakesWon++;
        this.balance = this.stakeGoals.balance || this.balance;
        this.totalEarned += stake.payout || 0;
        log('  Won stake! +' + stake.payout + ' HP for ' + stake.label, 'success');
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
          await sleep(randomDelay(800, 1500));
        } else {
          break;
        }
      }
    }
    return 0;
  }

  async processAccount(account) {
    const shortAddr = this.address ? 
      this.address.substring(0, 8) + '...' + this.address.substring(this.address.length - 6) : 
      'unknown';
    
    logBanner('Account ' + shortAddr);
    if (this.useProxy && this.proxyManager) {
      log('Using proxies (' + this.proxyManager.getProxyCount() + ' available)', 'proxy');
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
        log('Login attempt ' + attempt + ' failed, retrying...', 'warning');
        await sleep(3000);
      }
    }
    
    if (!loginSuccess) {
      log('Failed to login after 3 attempts', 'error');
      return null;
    }

    await this.applyReferralIfNeeded().catch(() => {});
    await this.completeProfile().catch(() => {});
    
    await this.processWellnessLogging().catch(() => {});
    await this.processPulse().catch(() => {});
    await this.processDailyQuiz().catch(() => {});
    await this.processDeck().catch((e) => {
      if (e.message === 'AUTH_EXPIRED') {
        return this.login(account.privateKey, true).then(() => this.processDeck()).catch(() => 0);
      }
      return 0;
    });
    
    await this.processAllMissions().catch(() => {});
    await this.processDailyCheckin().catch(() => {});
    await this.processPulseReveal().catch(() => {});
    await this.processReferral().catch(() => {});
    
    await this.processBadges().catch((e) => {
      log('Badge processing error: ' + e.message, 'error');
    });
    
    await this.processAgents().catch(() => {});
    await this.processCampaigns().catch(() => {});
    
    await this.processStaking().catch(() => {});
    await this.trackRank().catch(() => {});
    await this.fetchDeck().catch(() => {});
    
    const result = {
      address: this.address,
      balance: this.balance,
      earnedToday: this.earnedToday,
      cardsAnswered: this.dailyStats.totalCardsAnswered,
      campaignsCompleted: this.dailyStats.totalCampaignsCompleted,
      badgesClaimed: this.dailyStats.badgesClaimed,
      badgesSynced: this.dailyStats.badgesSynced,
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
      agentChats: this.dailyStats.agentChats,
      agentRewards: this.dailyStats.agentRewards,
      dailyCheckinClaimed: this.dailyStats.dailyCheckinClaimed,
      quizCompleted: this.dailyStats.quizCompleted,
      pulseAnswered: this.dailyStats.pulseAnswered,
      profileCompleted: this.dailyStats.profileCompleted,
      referralGenerated: this.dailyStats.referralGenerated,
      missionsClaimed: this.dailyStats.missionsClaimed,
      missionsReward: this.dailyStats.missionsReward,
      rank: this.rank ? this.rank.current.name : null,
      referralLink: this.referralLink,
      referralBonus: this._referralBonus,
    };
    
    logBanner('Account Complete!');
    log('Balance: ' + formatNumber(this.balance) + ' HP', 'coin');
    log('Earned: ' + formatNumber(this.totalEarned) + ' HP', 'success');
    log('Cards: ' + this.dailyStats.totalCardsAnswered, 'info');
    log('Campaigns: ' + this.dailyStats.totalCampaignsCompleted, 'info');
    log('Badges Minted: ' + this.dailyStats.badgesClaimed, 'badge');
    log('Badges Synced: ' + this.dailyStats.badgesSynced, 'sync');
    log('Wellness: ' + this.dailyStats.wellnessGoalsCompleted, 'wellness');
    log('Water: ' + this.dailyStats.waterMl + 'ml', 'water');
    log('Mood: ' + (this.dailyStats.moodLogged ? 'Yes' : 'No'), 'mood');
    log('Stakes: ' + this.dailyStats.stakesWon + ' won, ' + this.dailyStats.stakesLost + ' lost', 'stake');
    log('AI Agent Chats: ' + this.dailyStats.agentChats + ' (' + this.dailyStats.agentRewards + ' HP)', 'agent');
    if (this.dailyStats.aiAnswers > 0) {
      log('AI: ' + this.dailyStats.aiAnswers + ' answers', 'info');
    }
    log('Daily Check-in: ' + (this.dailyStats.dailyCheckinClaimed ? '✅' : '❌'), 'checkin');
    log('Quiz: ' + (this.dailyStats.quizCompleted ? '✅' : '❌'), 'quiz');
    log('Pulse: ' + (this.dailyStats.pulseAnswered ? '✅' : '❌'), 'pulse');
    log('Profile: ' + (this.dailyStats.profileCompleted ? '✅' : '❌'), 'profile');
    log('Missions: ' + this.dailyStats.missionsClaimed + ' (' + this.dailyStats.missionsReward + ' HP)', 'mission');
    if (this.rank) {
      log('Rank: ' + this.rank.current.name, 'rank');
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
      badgesSynced: 0,
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
      agentChats: 0,
      agentRewards: 0,
      dailyCheckins: 0,
      quizzesCompleted: 0,
      pulsesAnswered: 0,
      profilesCompleted: 0,
      referralsGenerated: 0,
      missionsClaimed: 0,
      missionsReward: 0,
    };
    
    while (true) {
      const accounts = parseAccounts();
      if (accounts.length === 0) {
        log('No accounts found in accounts.txt', 'error');
        return;
      }
      
      log('Found ' + accounts.length + ' accounts', 'info');
      
      const allResults = [];
      let successful = 0;
      
      const runStats = {
        totalHP: 0,
        totalCardsAnswered: 0,
        totalCampaignsCompleted: 0,
        badgesClaimed: 0,
        badgesSynced: 0,
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
        agentChats: 0,
        agentRewards: 0,
        dailyCheckins: 0,
        quizzesCompleted: 0,
        pulsesAnswered: 0,
        profilesCompleted: 0,
        referralsGenerated: 0,
        missionsClaimed: 0,
        missionsReward: 0,
      };
      
      for (let i = 0; i < accounts.length; i++) {
        log('Processing ' + (i + 1) + '/' + accounts.length, 'highlight');
        
        const bot = new SaviorOfHealthBot(this.useProxy);
        const result = await bot.processAccount(accounts[i]);
        
        if (result) {
          successful++;
          allResults.push(result);
          
          runStats.totalHP += result.balance || 0;
          runStats.totalCardsAnswered += result.cardsAnswered || 0;
          runStats.totalCampaignsCompleted += result.campaignsCompleted || 0;
          runStats.badgesClaimed += result.badgesClaimed || 0;
          runStats.badgesSynced += result.badgesSynced || 0;
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
          runStats.agentChats += result.agentChats || 0;
          runStats.agentRewards += result.agentRewards || 0;
          runStats.dailyCheckins += result.dailyCheckinClaimed ? 1 : 0;
          runStats.quizzesCompleted += result.quizCompleted ? 1 : 0;
          runStats.pulsesAnswered += result.pulseAnswered ? 1 : 0;
          runStats.profilesCompleted += result.profileCompleted ? 1 : 0;
          runStats.referralsGenerated += result.referralGenerated ? 1 : 0;
          runStats.missionsClaimed += result.missionsClaimed || 0;
          runStats.missionsReward += result.missionsReward || 0;
          
          grandTotal.accountsProcessed++;
          grandTotal.totalHP += result.balance || 0;
          grandTotal.totalCardsAnswered += result.cardsAnswered || 0;
          grandTotal.totalCampaignsCompleted += result.campaignsCompleted || 0;
          grandTotal.badgesClaimed += result.badgesClaimed || 0;
          grandTotal.badgesSynced += result.badgesSynced || 0;
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
          grandTotal.agentChats += result.agentChats || 0;
          grandTotal.agentRewards += result.agentRewards || 0;
          grandTotal.dailyCheckins += result.dailyCheckinClaimed ? 1 : 0;
          grandTotal.quizzesCompleted += result.quizCompleted ? 1 : 0;
          grandTotal.pulsesAnswered += result.pulseAnswered ? 1 : 0;
          grandTotal.profilesCompleted += result.profileCompleted ? 1 : 0;
          grandTotal.referralsGenerated += result.referralGenerated ? 1 : 0;
          grandTotal.missionsClaimed += result.missionsClaimed || 0;
          grandTotal.missionsReward += result.missionsReward || 0;
          
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
          const baseDelay = CONFIG.delayBetweenAccounts || 5000;
          const jitter = Math.floor(Math.random() * 3000);
          const waitTime = baseDelay + jitter;
          log('Waiting ' + Math.round(waitTime/1000) + 's before next account...', 'sleep');
          await sleep(waitTime);
        }
      }
      
      logBanner('FINAL SUMMARY');
      log('Successful: ' + successful + '/' + accounts.length, 'success');
      log('Total HP: ' + formatNumber(runStats.totalHP), 'coin');
      log('Cards answered: ' + runStats.totalCardsAnswered, 'info');
      log('Campaigns completed: ' + runStats.totalCampaignsCompleted, 'info');
      log('Badges Minted: ' + runStats.badgesClaimed, 'badge');
      log('Badges Synced: ' + runStats.badgesSynced, 'sync');
      log('Wellness goals: ' + runStats.wellnessGoalsCompleted, 'wellness');
      log('Meals logged: ' + runStats.mealsLogged, 'nutrition');
      log('Exercise minutes: ' + runStats.exerciseMinutes, 'wellness');
      log('Sleep hours: ' + runStats.sleepHours.toFixed(1), 'wellness');
      log('Meditation minutes: ' + runStats.meditationMinutes, 'mind');
      log('Triage chats: ' + runStats.triageChats, 'triage');
      log('Water: ' + runStats.waterMl + 'ml', 'water');
      log('Mood logged: ' + runStats.moodLogged + ' times', 'mood');
      log('Stakes: ' + runStats.stakesPlaced + ' placed, ' + runStats.stakesWon + ' won, ' + runStats.stakesLost + ' lost', 'stake');
      log('AI Agent Chats: ' + runStats.agentChats + ' (' + runStats.agentRewards + ' HP)', 'agent');
      if (runStats.aiAnswers > 0) {
        log('AI answers: ' + runStats.aiAnswers + ' (' + runStats.aiAttempts + ' attempts)', 'info');
      }
      
      logBanner('HEALDROP SUMMARY');
      log('Daily Check-ins: ' + runStats.dailyCheckins, 'checkin');
      log('Quizzes completed: ' + runStats.quizzesCompleted, 'quiz');
      log('Pulses answered: ' + runStats.pulsesAnswered, 'pulse');
      log('Profiles completed: ' + runStats.profilesCompleted, 'profile');
      log('Referrals generated: ' + runStats.referralsGenerated, 'referral');
      log('Missions claimed: ' + runStats.missionsClaimed + ' (' + runStats.missionsReward + ' HP)', 'mission');
      
      log('Proxy: ' + (this.useProxy ? 'Enabled' : 'Disabled'), 'proxy');
      
      if (allResults.length > 0) {
        log('Account Results:', 'info');
        for (const result of allResults) {
          const shortAddr = result.address ? 
            result.address.substring(0, 8) + '...' + result.address.substring(result.address.length - 6) : 
            'unknown';
          log('  ' + shortAddr + ': ' + formatNumber(result.balance) + ' HP (Cards: ' + (result.cardsAnswered || 0) + ', Campaigns: ' + (result.campaignsCompleted || 0) + ', Agent Chats: ' + (result.agentChats || 0) + ', Rank: ' + (result.rank || 'N/A') + ')', 'info');
        }
      }
      
      if (CONFIG.sleepUntilNextDay) {
        const timeUntil = getTimeUntilNextDay();
        const hours = Math.floor(timeUntil / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        
        logBanner('Sleeping until next day');
        log('' + hours + 'h ' + minutes + 'm until daily reset', 'sleep');
        log('Next run at: ' + new Date(Date.now() + timeUntil).toLocaleString(), 'sleep');
        
        const intervalMs = CONFIG.checkIntervalMinutes * 60 * 1000;
        let remaining = timeUntil;
        
        while (remaining > 0) {
          const sleepTime = Math.min(remaining, intervalMs);
          await sleep(sleepTime);
          remaining -= sleepTime;
          
          if (remaining > 0) {
            const remainingHours = Math.floor(remaining / (1000 * 60 * 60));
            const remainingMin = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            log('' + remainingHours + 'h ' + remainingMin + 'm remaining...', 'sleep');
          }
        }
        
        log('New day started!', 'success');
        await sleep(randomDelay(2000, 8000));
      }
    }
  }
}

function showMenu() {
  console.log('\n' + COLORS.brightCyan + '='.repeat(60) + COLORS.reset);
  console.log(COLORS.brightYellow + '  SAVIOROFHEALTH BOT MENU  ' + COLORS.reset);
  console.log(COLORS.brightCyan + '='.repeat(60) + COLORS.reset);
  console.log(COLORS.brightGreen + '  1.' + COLORS.reset + ' Run without proxy (Direct connection)');
  console.log(COLORS.brightYellow + '  2.' + COLORS.reset + ' Run with proxy (Load from proxy.txt)');
  console.log(COLORS.brightRed + '  3.' + COLORS.reset + ' Exit');
  console.log(COLORS.brightCyan + '='.repeat(60) + COLORS.reset);
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
    const choice = await askQuestion(COLORS.brightCyan + 'Enter your choice (1-3): ' + COLORS.reset);
    
    if (choice === '1') {
      logBanner('Starting bot without proxy...');
      const bot = new SaviorOfHealthBot(false);
      await bot.run();
      break;
    } else if (choice === '2') {
      logBanner('Starting bot with proxy...');
      const bot = new SaviorOfHealthBot(true);
      await bot.run();
      break;
    } else if (choice === '3') {
      log('Exiting...', 'info');
      process.exit(0);
    } else {
      log('Invalid choice. Please enter 1, 2, or 3.', 'error');
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    log('Fatal error: ' + error.message, 'error');
    process.exit(1);
  });
}

module.exports = SaviorOfHealthBot;