#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const BASE_DIR = __dirname;
const ACCOUNTS_FILE = path.join(BASE_DIR, 'accounts.txt');
const GROQ_KEY_FILE = path.join(BASE_DIR, 'groq.txt');
const XTOKEN_FILE = path.join(BASE_DIR, 'xtoken.txt');
const PROXY_FILE = path.join(BASE_DIR, 'proxy.txt');

const CONFIG = {
  apiUrl: 'https://saviorofhealth.app',
  xBearer: 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
  maxPostsPerDay: 2,
  groqTimeout: 30000,
  groqModels: [
    'qwen/qwen3.6-27b',
    'canopylabs/orpheus-v1-english'
  ],
  gptOssModels: [
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-safeguard-20b'
  ],
  postDelayMin: 120000,
  postDelayMax: 240000,
  accountDelayMin: 300000,
  accountDelayMax: 600000,
  minRequestDelay: 1000,
  maxRequestDelay: 5000,
  minRequestInterval: 3000,
};

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightCyan: '\x1b[96m',
  brightRed: '\x1b[91m',
  brightMagenta: '\x1b[95m',
};

let lastRequestTime = 0;
let proxyErrorCount = {};
let currentXTokenIndex = 0;
let sessionProxy = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

function generateTransactionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let id = '';
  for (let i = 0; i < 64; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function log(message, type = 'info', data = null) {
  const styles = {
    info: { color: COLORS.cyan, icon: 'ℹ️' },
    success: { color: COLORS.brightGreen, icon: '✅' },
    warning: { color: COLORS.brightYellow, icon: '⚠️' },
    error: { color: COLORS.brightRed, icon: '❌' },
    highlight: { color: COLORS.brightMagenta, icon: '✨' },
    debug: { color: COLORS.gray, icon: '🔍' },
    x: { color: COLORS.brightCyan, icon: '🐦' },
    claim: { color: COLORS.brightGreen, icon: ' 🎯' },
    sleep: { color: COLORS.brightYellow, icon: '💤' },
    nextday: { color: COLORS.brightYellow, icon: '🌅' },
    groq: { color: COLORS.brightMagenta, icon: '🧠' },
    rotate: { color: COLORS.brightYellow, icon: '🔄' },
  };
  const style = styles[type] || styles.info;
  const prefix = `${style.color}${style.icon}${COLORS.reset}`;
  const msg = `${style.color}${message}${COLORS.reset}`;
  if (data) console.log(`${prefix} ${msg}`);
  else console.log(`${prefix} ${msg}`);
}

function logBanner(message) {
  console.log(`\n${COLORS.brightCyan}${'='.repeat(50)}${COLORS.reset}`);
  console.log(`${COLORS.brightYellow}  ${message}  ${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}${'='.repeat(50)}${COLORS.reset}\n`);
}

function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) return [];
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

function loadXTokens() {
  try {
    const raw = fs.readFileSync(XTOKEN_FILE, 'utf-8').replace(/\r/g, '');
    return raw.split(/\n\s*\n/).map(block => {
      const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
      return {
        username: lines[0],
        auth_token: lines[1],
        ct0: lines[2],
        valid: !!(lines[0] && lines[1] && lines[2])
      };
    }).filter(t => t.valid);
  } catch {
    return [];
  }
}

function loadProxies() {
  try {
    const raw = fs.readFileSync(PROXY_FILE, 'utf-8').replace(/\r/g, '');
    return raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

function loadGroqKeys() {
  try {
    if (fs.existsSync(GROQ_KEY_FILE)) {
      const content = fs.readFileSync(GROQ_KEY_FILE, 'utf8');
      const lines = content.split('\n').map(line => line.trim()).filter(line => line);
      const keys = [];
      for (const line of lines) {
        if (line.startsWith('gsk_')) {
          keys.push(line);
        }
      }
      if (keys.length > 0) {
        log('Loaded ' + keys.length + ' Groq API keys from groq.txt', 'success');
        return keys;
      }
    }
    log('No Groq API keys found in groq.txt', 'error');
    process.exit(1);
  } catch (error) {
    log('Failed to load Groq API keys: ' + error.message, 'error');
    process.exit(1);
  }
}

function getProxyForSession(proxies) {
  if (proxies.length === 0) return null;
  
  if (sessionProxy) {
    return sessionProxy;
  }
  
  const workingProxies = proxies.filter(p => {
    const errors = proxyErrorCount[p] || 0;
    return errors < 3;
  });
  
  if (workingProxies.length === 0) {
    proxyErrorCount = {};
    sessionProxy = proxies[0];
    return sessionProxy;
  }
  
  sessionProxy = workingProxies[Math.floor(Math.random() * workingProxies.length)];
  log(`🌐 Using proxy for session: ${proxyString.split('@').pop() || proxyString}`, 'info');
  return sessionProxy;
}

class GroqManager {
  constructor() {
    this.apiKeys = [];
    this.currentKeyIndex = 0;
    this.currentModelIndex = 0;
    this.allModels = [...CONFIG.groqModels, ...CONFIG.gptOssModels];
    this.failedKeys = new Set();
    this.rateLimitedKeys = new Set();
    this.loadApiKeys();
    this.useTemplates = this.apiKeys.length === 0;
    
    if (this.useTemplates) {
      log('❌ No valid Groq keys found - exiting', 'error');
      process.exit(1);
    } else {
      log('✅ Groq AI ready with ' + this.apiKeys.length + ' key(s)', 'success');
    }
  }

  loadApiKeys() {
    this.apiKeys = loadGroqKeys();
    return this.apiKeys.length > 0;
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
    if (this.allModels.length === 0) return null;
    return this.allModels[this.currentModelIndex % this.allModels.length];
  }

  isGptOssModel(model) {
    return model && model.startsWith('openai/gpt-oss');
  }

  rotateKey(reason = 'Error') {
    if (this.apiKeys.length === 0) return null;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    log('🔄 Rotated Groq key (' + (this.currentKeyIndex + 1) + '/' + this.apiKeys.length + ')', 'rotate');
    return this.apiKeys[this.currentKeyIndex];
  }

  markKeyFailed(key) {
    if (!key) return;
    this.failedKeys.add(key);
  }

  markKeyRateLimited(key) {
    if (!key) return;
    this.rateLimitedKeys.add(key);
  }

  async ask(question, options = null, proxies = []) {
    if (this.apiKeys.length === 0) {
      throw new Error('No Groq API keys available');
    }

    let attempts = 0;
    const maxAttempts = Math.max(this.apiKeys.length * 2, 5);

    while (attempts < maxAttempts) {
      const key = this.getCurrentKey();
      const model = this.getCurrentModel();

      if (!key) {
        throw new Error('No valid Groq key available');
      }

      try {
        const proxyString = proxies.length > 0 ? getProxyForSession(proxies) : null;
        const isGptOss = this.isGptOssModel(model);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.groqTimeout || 30000);

        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < CONFIG.minRequestInterval) {
          await sleep(CONFIG.minRequestInterval - timeSinceLastRequest + Math.random() * 1000);
        }
        lastRequestTime = Date.now();

        let endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        let requestBody;

        if (isGptOss) {
          endpoint = 'https://api.groq.com/openai/v1/responses';
          requestBody = {
            model: model,
            input: question,
            temperature: 0.9,
            max_output_tokens: 150,
            instructions: 'You are a real person sharing authentic health experiences.'
          };
        } else {
          requestBody = {
            model: model,
            messages: [
              { 
                role: 'system', 
                content: 'You are a real person sharing authentic health experiences. Write naturally like a human, not an AI.' 
              },
              { role: 'user', content: question }
            ],
            temperature: 0.9,
            max_tokens: 150,
          };
        }

        const fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key,
            'User-Agent': getRandomUserAgent(),
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        };

        if (proxyString) {
          try {
            const url = new URL(proxyString);
            if (url.protocol === 'socks5:' || url.protocol === 'socks5h:') {
              const { SocksProxyAgent } = require('socks-proxy-agent');
              fetchOptions.agent = new SocksProxyAgent(proxyString);
            } else {
              const { HttpsProxyAgent } = require('https-proxy-agent');
              fetchOptions.agent = new HttpsProxyAgent(proxyString);
            }
          } catch (e) {}
        }

        const response = await fetch(endpoint, fetchOptions);
        clearTimeout(timeoutId);

        if (response.status === 429) {
          this.markKeyRateLimited(key);
          this.rotateKey('Rate limit');
          await sleep(30000);
          continue;
        }

        if (response.status === 401 || response.status === 403) {
          this.markKeyFailed(key);
          this.rotateKey('Auth error');
          await sleep(2000);
          continue;
        }

        if (!response.ok) {
          this.markKeyFailed(key);
          this.rotateKey('API error');
          await sleep(2000);
          continue;
        }

        const data = await response.json();
        let answer = null;

        if (isGptOss) {
          if (data.output && Array.isArray(data.output)) {
            for (const item of data.output) {
              if (item.type === 'message' && item.content && item.content.length > 0) {
                for (const contentItem of item.content) {
                  if (contentItem.type === 'output_text' && contentItem.text) {
                    answer = contentItem.text;
                    break;
                  }
                }
                if (answer) break;
              }
            }
          }
          if (!answer && data.output_text) {
            answer = data.output_text;
          }
        } else {
          if (data.choices && data.choices[0] && data.choices[0].message) {
            answer = data.choices[0].message.content;
          }
        }

        if (!answer) {
          this.currentModelIndex = (this.currentModelIndex + 1) % this.allModels.length;
          await sleep(1000);
          continue;
        }

        answer = answer.trim();
        answer = answer.replace(/^["']|["']$/g, '').trim();
        answer = stripMarkdown(answer);

        const preamblePhrases = [
          "here's",
          "here is",
          "this tweet",
          "tweet:",
          "my tweet:",
          "a tweet",
          "this is a",
          "i'd write",
          "you could",
          "you might",
          "one example",
          "something like",
          "perhaps",
          "how about",
          "try this",
          "note:",
          "based on",
          "concise",
          "meets the requirements",
          "genuine-sounding"
        ];

        const lines = answer.split('\n').filter(l => l.trim());
        let cleanAnswer = '';
        
        for (const line of lines) {
          const trimmed = line.trim().toLowerCase();
          
          let isPreamble = false;
          for (const phrase of preamblePhrases) {
            if (trimmed.startsWith(phrase)) {
              isPreamble = true;
              break;
            }
          }
          
          if (isPreamble) continue;
          
          if (trimmed.startsWith('#') || 
              trimmed.startsWith('**') ||
              trimmed.startsWith('-') && trimmed.length < 20 ||
              trimmed.startsWith('*')) {
            continue;
          }
          
          const originalLine = line.trim();
          if (originalLine.length > 10 && !cleanAnswer) {
            cleanAnswer = originalLine;
            break;
          }
        }

        if (!cleanAnswer) {
          cleanAnswer = answer;
        }

        cleanAnswer = cleanAnswer
          .replace(/^\*\*|\*\*$/g, '')
          .replace(/^- /, '')
          .replace(/^["']|["']$/, '')
          .trim();

        if (cleanAnswer.length < 10 || cleanAnswer.length > 280) {
          this.currentModelIndex = (this.currentModelIndex + 1) % this.allModels.length;
          await sleep(1000);
          continue;
        }

        log('✅ Groq generated tweet: ' + cleanAnswer.substring(0, 40) + '...', 'groq');
        return cleanAnswer;

      } catch (error) {
        if (error.name === 'AbortError') {
          log('⏰ Groq timeout', 'warning');
          this.rotateKey('Timeout');
        } else {
          log('❌ Groq error: ' + error.message, 'error');
          this.rotateKey('Network error');
        }
        await sleep(2000);
      }

      attempts++;
    }

    throw new Error('Groq failed to generate tweet after all attempts');
  }
}

let groqManager = null;

function initGroqManager() {
  if (!groqManager) {
    groqManager = new GroqManager();
  }
  return groqManager;
}

function createProxyAgent(proxyString) {
  if (!proxyString) return null;
  try {
    const url = new URL(proxyString);
    if (url.protocol === 'socks5:' || url.protocol === 'socks5h:') {
      const { SocksProxyAgent } = require('socks-proxy-agent');
      return new SocksProxyAgent(proxyString);
    } else {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      return new HttpsProxyAgent(proxyString);
    }
  } catch (e) {
    return null;
  }
}

async function fetchWithProxy(url, options = {}, proxyString = null) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const baseDelay = CONFIG.minRequestInterval + Math.random() * 2000;
  
  if (timeSinceLastRequest < baseDelay) {
    const waitTime = baseDelay - timeSinceLastRequest;
    await sleep(waitTime + Math.random() * 1000);
  }
  lastRequestTime = Date.now();

  const headers = options.headers || {};
  if (!headers['User-Agent']) {
    headers['User-Agent'] = getRandomUserAgent();
  }

  const finalOptions = { ...options, headers };
  if (proxyString) {
    const agent = createProxyAgent(proxyString);
    if (agent) finalOptions.agent = agent;
  }

  return fetch(url, finalOptions);
}

function cleanTweetText(text) {
  let cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/‑/g, '-')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/…/g, '...')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/\u200C/g, '')
    .replace(/\u200D/g, '')
    .trim();
  
  let result = '';
  const emojiRegex = /[\u{1F000}-\u{1FFFF}]/u;
  const allowedSymbols = /[a-zA-Z0-9 .,!?#$%&()*+\-/:;<=>@[\]^_{|}~']/;
  
  for (const char of cleaned) {
    if (allowedSymbols.test(char) || emojiRegex.test(char) || char === ' ') {
      result += char;
    }
  }
  
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

async function generateTweet(proxies = []) {
  const groq = initGroqManager();
  
  const prompts = [
    `JUST TWEET THIS. NO PREAMBLE. Just a tweet about health today under 280 chars with #SOH #saviorofhealth. Be human. Write it now.`,
    `TWEET NOW. No "here's", no "this tweet", no explanation. Just write what you'd post about health. Under 280 chars. #SOH #saviorofhealth.`,
    `Stop explaining. Just write a tweet right now about your health. Casual human vibes. Under 280 chars. #SOH #saviorofhealth. NOW.`,
    `Tweet only. No words before or after. Just the tweet about staying healthy today. Under 280 chars. #SOH #saviorofhealth.`,
    `Write JUST the tweet. Nothing else. About your health journey. Casual and real. Under 280 chars. #SOH #saviorofhealth.`,
    `Only output a tweet. No preamble. About health. Human. Under 280 chars. #SOH #saviorofhealth. Do it now.`,
    `I need ONLY a tweet now. No introduction. Just health content. Human style. Under 280 chars. #SOH #saviorofhealth.`,
    `Generate a single tweet ONLY. No setup text. Pure tweet. Health topic. Under 280 chars. #SOH #saviorofhealth.`,
    `Tweet this second. Nothing before. Just one tweet about wellness. Human tone. Under 280 chars. #SOH #saviorofhealth.`,
    `DO NOT EXPLAIN. Just tweet about your health. Casual. Under 280 chars. #SOH #saviorofhealth.`,
    `Forget preamble. Tweet health content now. Human voice. Under 280 chars. #SOH #saviorofhealth. Start with no intro.`,
    `Zero introduction. Just a health tweet. Real human. Under 280 chars. #SOH #saviorofhealth. Tweet it.`,
  ];
  
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  let tweetText = null;
  let lastError = null;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const answer = await groq.ask(prompt, null, proxies);
      if (answer && answer.length > 10 && answer.length <= 280) {
        tweetText = answer;
        break;
      }
    } catch (error) {
      lastError = error;
      log(`Groq attempt ${attempt + 1} failed: ${error.message}`, 'warning');
      await sleep(2000);
    }
  }
  
  if (!tweetText) {
    throw new Error(`Failed to generate tweet with Groq: ${lastError ? lastError.message : 'Unknown error'}`);
  }
  
  tweetText = cleanTweetText(tweetText);
  
  if (!tweetText.includes('#SOH') && !tweetText.includes('#saviorofhealth')) {
    if (tweetText.length < 250) {
      tweetText = tweetText + ' #SOH #saviorofhealth';
    } else {
      tweetText = tweetText.substring(0, 245) + ' #SOH #saviorofhealth';
    }
  }
  
  if (!tweetText.includes('#SOH')) {
    tweetText = tweetText + ' #SOH';
  }
  if (!tweetText.includes('#saviorofhealth')) {
    tweetText = tweetText + ' #saviorofhealth';
  }
  
  tweetText = tweetText.replace(/#SOH\s+#SOH/g, '#SOH');
  tweetText = tweetText.replace(/#saviorofhealth\s+#saviorofhealth/g, '#saviorofhealth');
  
  tweetText = cleanTweetText(tweetText);
  
  if (tweetText.length < 10 || tweetText.length > 280) {
    throw new Error(`Tweet text invalid length: ${tweetText.length}`);
  }
  
  return tweetText;
}

function generateSIWEMessage(address, chainId = 56) {
  const nonce = Math.random().toString(36).substring(2, 18);
  return [
    'saviorofhealth wants you to sign in with your wallet.',
    '',
    'Address: ' + address,
    'Chain ID: ' + chainId,
    'Nonce: ' + nonce,
    'Issued At: ' + Date.now(),
    '',
    'This is a free, gas-less signature. It only proves you own this wallet. No transaction is sent.'
  ].join('\n');
}

async function loginSavior(privateKey, proxyString = null) {
  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;

  const message = generateSIWEMessage(address, 56);
  const signature = await wallet.signMessage(message);

  const response = await fetchWithProxy(CONFIG.apiUrl + '/api/auth/wallet/siwe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, signature }),
  }, proxyString);

  const data = await response.json();
  if (!data.token) {
    throw new Error(data.error || 'Login failed');
  }
  return { token: data.token, user: data.user };
}

async function postTweet(xtoken, text, proxies = [], retries = 0, isFirstPost = true) {
  const MAX_RETRIES = 3;
  const QUERY_ID = "WXTdKnLddrQOunD6MhWi3g";

  const proxyString = proxies.length > 0 ? getProxyForSession(proxies) : null;

  let finalText = cleanTweetText(text);
  
  log(`📝 Cleaned tweet (${finalText.length} chars): ${finalText.substring(0, 60)}...`, 'debug');

  if (!isFirstPost) {
    const delay = randomDelay(CONFIG.postDelayMin, CONFIG.postDelayMax);
    const secs = Math.floor(delay / 1000);
    const mins = Math.floor(secs / 60);
    log(`⏳ Waiting ${mins}m ${secs % 60}s before next post...`, 'sleep');
    await sleep(delay);
  } else {
    log('📤 Posting first tweet...', 'info');
  }

  const typingDelay = isFirstPost ? randomDelay(1000, 3000) : randomDelay(2000, 5000);
  log(`⌨️ Simulating typing for ${Math.floor(typingDelay/1000)}s...`, 'info');
  await sleep(typingDelay);

  const transactionId = generateTransactionId();

  const headers = {
    'accept': '*/*',
    'accept-language': 'en-GB,en;q=0.9,fr;q=0.8,ar;q=0.7,en-US;q=0.6,zh-CN;q=0.5,zh;q=0.4',
    'authorization': `Bearer ${CONFIG.xBearer}`,
    'content-type': 'application/json',
    'origin': 'https://x.com',
    'priority': 'u=1, i',
    'referer': 'https://x.com/compose/post',
    'sec-ch-ua': '"Chromium";v="140", "Not_A Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': getRandomUserAgent(),
    'x-client-transaction-id': transactionId,
    'x-csrf-token': xtoken.ct0,
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
  };

  headers['cookie'] = `auth_token=${xtoken.auth_token}; ct0=${xtoken.ct0}`;

  const payload = {
    variables: {
      tweet_text: finalText,
      media: {
        media_entities: [],
        possibly_sensitive: false
      },
      semantic_annotation_ids: [],
      disallowed_reply_options: null,
      semantic_annotation_options: {
        source: "Profile"
      }
    },
    features: {
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: true,
      rweb_cashtags_composer_attachment_enabled: true,
      responsive_web_jetfuel_frame: true,
      responsive_web_grok_share_attachment_enabled: true,
      responsive_web_grok_annotations_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      rweb_conversational_replies_downvote_enabled: false,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      content_disclosure_indicator_enabled: true,
      content_disclosure_ai_generated_indicator_enabled: true,
      responsive_web_grok_show_grok_translated_post: true,
      responsive_web_grok_analysis_button_from_backend: true,
      post_ctas_fetch_enabled: false,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: false,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      responsive_web_profile_redirect_enabled: true,
      rweb_tipjar_consumption_enabled: false,
      verified_phone_label_enabled: false,
      articles_preview_enabled: true,
      rweb_cashtags_enabled: true,
      responsive_web_grok_community_note_auto_translation_is_enabled: true,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_grok_imagine_annotation_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true
    },
    queryId: QUERY_ID
  };

  try {
    log(`📤 Sending tweet request with transaction ID...`, 'info');
    
    const response = await fetchWithProxy(`https://x.com/i/api/graphql/${QUERY_ID}/CreateTweet`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    }, proxyString);

    const textResponse = await response.text();
    log(`📊 Response status: ${response.status}`, 'debug');
    
    let result;
    try {
      result = JSON.parse(textResponse);
    } catch {
      log(`⚠️ Invalid JSON response: ${textResponse.substring(0, 200)}`, 'error');
      throw new Error('Invalid response from X');
    }

    if (result?.data?.create_tweet?.tweet_results?.result?.rest_id) {
      const tweetId = result.data.create_tweet.tweet_results.result.rest_id;
      const username = result.data.create_tweet.tweet_results.result.core?.user_results?.result?.legacy?.screen_name;
      log(`✅ Tweet ID: ${tweetId}`, 'success');
      await sleep(randomDelay(2000, 5000));
      return `https://twitter.com/${username || 'user'}/status/${tweetId}`;
    }

    if (result?.data?.create_tweet?.tweet_results && Object.keys(result.data.create_tweet.tweet_results).length === 0) {
      const emojis = [' 💪', ' 🌟', ' ✨', ' 🔥', ' 🎯', ' 💚', ' 🌱', ' 💯', ' ⚡', ' 🌈', ' 🚀', ' 💫'];
      const suffix = emojis[Math.floor(Math.random() * emojis.length)];
      
      if (finalText.length < 270) {
        finalText = finalText + suffix;
      } else {
        finalText = finalText.substring(0, 265) + suffix;
      }
      
      log(`🔄 Tweet rejected, retrying with suffix: ${suffix}`, 'rotate');
      
      if (retries < MAX_RETRIES) {
        return postTweet(xtoken, finalText, proxies, retries + 1, false);
      }
      throw new Error('Tweet rejected after retries');
    }

    if (result?.errors) {
      const errorMsg = result.errors[0]?.message || 'Unknown error';
      log(`❌ X API Error: ${errorMsg}`, 'error');
      
      if (errorMsg.toLowerCase().includes('daily limit') || errorMsg.toLowerCase().includes('rate')) {
        throw new Error('XLimit::RateLimited');
      }
      throw new Error(`XError: ${errorMsg}`);
    }

    log(`⚠️ Response: ${JSON.stringify(result).substring(0, 300)}`, 'debug');
    throw new Error('No tweet ID in response');

  } catch (error) {
    const errorMsg = error.message || '';
    log('❌ Post failed: ' + errorMsg, 'error');
    
    if (errorMsg.includes('XLimit::RateLimited')) {
      log('⏳ Rate limited, waiting 10-15 minutes...', 'warning');
      await sleep(randomDelay(600000, 900000));
      if (retries < MAX_RETRIES) {
        return postTweet(xtoken, finalText, proxies, retries + 1, false);
      }
      throw error;
    }
    
    if (retries < MAX_RETRIES) {
      const waitTime = (retries + 1) * 60000;
      log(`🔄 Retry ${retries + 1}/${MAX_RETRIES} in ${Math.round(waitTime/60000)} minutes...`, 'warning');
      await sleep(waitTime + Math.random() * 30000);
      return postTweet(xtoken, finalText, proxies, retries + 1, false);
    }
    throw error;
  }
}

function getNextXToken(xtokens) {
  if (xtokens.length === 0) return null;
  const xtoken = xtokens[currentXTokenIndex % xtokens.length];
  currentXTokenIndex++;
  return xtoken;
}

async function getPostsStatus(token, proxyString = null) {
  const response = await fetchWithProxy(CONFIG.apiUrl + '/api/posts', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
  }, proxyString);

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch posts status');
  }
  return data;
}

async function submitToSavior(token, tweetUrl, proxyString = null) {
  const response = await fetchWithProxy(CONFIG.apiUrl + '/api/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({ url: tweetUrl }),
  }, proxyString);

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Submission failed');
  }
  return data;
}

function getSleepUntilNextDay() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const timeUntilNextDay = tomorrow.getTime() - now.getTime();
  const randomOffset = randomDelay(0, 7200000);
  return timeUntilNextDay + randomOffset;
}

async function sleepUntilNextDay(reason = 'Daily limit reached') {
  const sleepTime = getSleepUntilNextDay();
  const hours = Math.floor(sleepTime / 3600000);
  const minutes = Math.floor((sleepTime % 3600000) / 60000);
  log(`🌅 Sleeping ${hours}h ${minutes}m - ${reason}`, 'nextday');
  await sleep(sleepTime);
  log('🌅 New day! Resuming...', 'success');
}

async function processAccount(account, xtokens, proxies, idx) {
  const shortAddr = account.privateKey.substring(0, 10) + '...' + account.privateKey.substring(account.privateKey.length - 6);
  const name = account.name || `Account ${idx + 1}`;

  sessionProxy = null;

  logBanner(`Processing ${name} (${shortAddr})`);

  try {
    const proxyString = proxies.length > 0 ? getProxyForSession(proxies) : null;
    const { token, user } = await loginSavior(account.privateKey, proxyString);
    log(`Logged in as ${user?.displayName || 'user'}`, 'success');

    const statusProxy = proxies.length > 0 ? getProxyForSession(proxies) : null;
    const status = await getPostsStatus(token, statusProxy);
    const remaining = status.todayRemaining || 0;
    const rewardPerPost = status.reward || 150;

    log(`Daily: ${remaining}/5 posts remaining (${rewardPerPost} HP each)`, 'info');

    if (remaining <= 0) {
      log('Daily limit reached!', 'warning');
      await sleepUntilNextDay('Daily limit reached');
      return processAccount(account, xtokens, proxies, idx);
    }

    const maxPosts = Math.min(remaining, CONFIG.maxPostsPerDay || 2);
    let posted = 0;
    let totalReward = 0;

    for (let i = 0; i < maxPosts; i++) {
      const xtoken = getNextXToken(xtokens);
      if (!xtoken) {
        log('No X tokens available', 'error');
        break;
      }

      log(`\n📝 Post ${i + 1}/${maxPosts}...`, 'highlight');

      let tweetText = await generateTweet(proxies);
      log(`📝 ${tweetText.substring(0, 80)}${tweetText.length > 80 ? '...' : ''}`, 'debug');

      try {
        const tweetUrl = await postTweet(xtoken, tweetText, proxies, 0, i === 0);
        log(`✅ Posted: ${tweetUrl}`, 'x');

        await sleep(randomDelay(5000, 10000));

        const submitProxy = proxies.length > 0 ? getProxyForSession(proxies) : null;
        const result = await submitToSavior(token, tweetUrl, submitProxy);
        if (result && result.ok) {
          const reward = result.reward || rewardPerPost;
          totalReward += reward;
          posted++;
          log(`🎯 +${reward} HP`, 'claim');
        }

        if (i < maxPosts - 1) {
          const delay = randomDelay(300000, 600000);
          const mins = Math.floor(delay / 60000);
          log(`💤 Waiting ${mins}m before next post...`, 'sleep');
          await sleep(delay);
        }

      } catch (error) {
        const errorMsg = error.message || '';
        log(`Post failed: ${errorMsg}`, 'error');

        if (errorMsg.includes('XLimit::RateLimited')) {
          log('⏳ Rate limited, waiting 15 minutes before retry...', 'warning');
          await sleep(randomDelay(600000, 900000));
          i--;
          continue;
        }

        log('Waiting before retry...', 'warning');
        await sleep(randomDelay(120000, 180000));
        i--;
      }
    }

    log(`\n✅ ${name}: ${posted} posts (${totalReward} HP)`, 'success');
    return { success: true, posts: posted, reward: totalReward };

  } catch (error) {
    log(`Account error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

async function runAllAccounts() {
  const accounts = loadAccounts();
  const xtokens = loadXTokens();
  const proxies = loadProxies();

  const groq = initGroqManager();

  if (accounts.length === 0) {
    log('No accounts in accounts.txt', 'error');
    return;
  }

  if (xtokens.length === 0) {
    log('No X tokens in xtoken.txt', 'error');
    return;
  }

  log(`Loaded ${proxies.length} proxies`, 'success');
  log(`Loaded ${accounts.length} wallet accounts`, 'success');
  log(`Loaded ${xtokens.length} X accounts`, 'success');
  log(`🧠 Groq AI enabled with ${groq.apiKeys.length} keys`, 'success');
  console.log('');

  const totalAccounts = Math.min(accounts.length, xtokens.length);

  for (let i = 0; i < totalAccounts; i++) {
    await processAccount(accounts[i], xtokens, proxies, i);

    if (i < totalAccounts - 1) {
      const delay = randomDelay(600000, 900000);
      const mins = Math.floor(delay / 60000);
      log(`💤 Waiting ${mins}m before next account...`, 'sleep');
      await sleep(delay);
    }
  }

  log('All accounts done. Sleeping until tomorrow...', 'nextday');
  await sleepUntilNextDay('All accounts completed');

  log('Starting new cycle...', 'info');
  await runAllAccounts();
}

const BANNER = `
╔═══════════════════════════════════╗
║ SaviorOfHealth Auto Tweet Bot    ║
║           mejri02                 ║
╚═══════════════════════════════════╝
`;

async function main() {
  console.log(BANNER);

  proxyErrorCount = {};
  currentXTokenIndex = 0;
  sessionProxy = null;

  while (true) {
    try {
      await runAllAccounts();
    } catch (error) {
      log(`Fatal: ${error.message}`, 'error');
      log('Restarting in 5 minutes...', 'warning');
      await sleep(300000);
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    log(`Fatal: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = { postTweet, submitToSavior, getPostsStatus };