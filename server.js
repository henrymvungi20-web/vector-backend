require('dotenv').config();
const express = require('express');
const cors = require('cors');
const MetaApi = require('metaapi.cloud-sdk').default;
const crypto = require('crypto');

const app = express();

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const token = process.env.META_API_TOKEN;
const api = new MetaApi(token);

const ADMIN_EMAIL = 'henrymvungi20@gmail.com'; 

// In-Memory Database store
let users = [
  {
    id: 'usr_demo_1',
    fullName: 'Henry Mvungi',
    email: 'henrymvungi20@gmail.com',
    phoneNumber: '+255000000000',
    country: 'Tanzania',
    tier: 'vecto2', // Default to Gold
    status: 'active',
    mt5Connected: true,
    mt5Locked: true,
    mt5Account: { login: '101236718', server: 'DerivSVG-Server-02' },
    activeCode: null,
    codeExpiresAt: null,
    pendingCode: null,
    paymentProof: null
  }
];

// Helper: Auto-assign Gold tier ('vecto2') by default so users never get blocked by memory wipes
const findOrCreateUser = (userId, email, fullName) => {
  let user = users.find(u => u.id === userId || (email && u.email && u.email.toLowerCase() === email.toLowerCase()));
  if (!user) {
    user = {
      id: userId || `usr_${Date.now()}`,
      fullName: fullName || 'Platform User',
      email: email || 'user@vector.ai',
      phoneNumber: '+255000000000',
      country: 'Tanzania',
      tier: 'vecto2', // Default new users to Gold so MT5 connects instantly
      status: 'active',
      mt5Connected: false,
      mt5Locked: false,
      mt5Account: null,
      activeCode: 'AUTO-GOLD',
      codeExpiresAt: new Date(Date.now() + 30*24*60*60*1000),
      pendingCode: null,
      paymentProof: null
    };
    users.push(user);
  } else {
    // Force active users to Gold tier during testing phase
    if (user.tier === 'free') {
      user.tier = 'vecto2';
    }
  }
  return user;
};

app.get('/', (req, res) => {
  res.send('Vector Backend is live');
});

// ==========================================
// 1. AUTHENTICATION & SIGN-UP
// ==========================================
app.post('/api/auth/signup', (req, res) => {
  const { id, fullName, email, phoneNumber, country } = req.body;
  if (!email || !fullName) {
    return res.status(400).json({ error: 'Email and full name are required.' });
  }

  let user = findOrCreateUser(id, email, fullName);
  if (phoneNumber) user.phoneNumber = phoneNumber;
  if (country) user.country = country;

  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  res.json({ success: true, user, isAdmin });
});

// ==========================================
// 2. ADMIN MANAGEMENT & INSTANT GRANT
// ==========================================
app.get('/api/admin/users', (req, res) => {
  const requesterEmail = req.query.email || req.headers['x-user-email'];
  if (!requesterEmail || requesterEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  res.json({ success: true, users });
});

app.post('/api/admin/grant-tier', (req, res) => {
  const { userId, email, fullName, plan, adminEmail } = req.body; 
  if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const user = findOrCreateUser(userId, email, fullName);
  user.tier = plan || 'vecto2'; 
  user.activeCode = `INSTANT-GRANT-${user.tier.toUpperCase()}`;
  
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);
  user.codeExpiresAt = expiresAt;
  user.pendingCode = null;

  res.json({ success: true, user });
});

// ==========================================
// 3. TRADING & METAAPI ENGINE
// ==========================================
async function getOrCreateAccount(login, password, server, name) {
  const accountApi = api.metatraderAccountApi;
  let accounts = [];
  try {
    if (typeof accountApi.getAccounts === 'function') {
      accounts = await accountApi.getAccounts();
    } else if (typeof accountApi.getAccountsWithInfiniteScrollPagination === 'function') {
      accounts = await accountApi.getAccountsWithInfiniteScrollPagination({ limit: 100 });
    }
  } catch (e) {
    console.log('Account fetch warning:', e.message);
  }

  let account = accounts.find(a => String(a.login) === String(login) && a.server === server);

  if (!account) {
    account = await accountApi.createAccount({
      name: name || `MT5-${login}`,
      type: 'cloud',
      login: String(login),
      password: password,
      server: server,
      platform: 'mt5',
      magic: 1000
    });
  }

  if (account.state !== 'DEPLOYED') {
    await account.deploy();
  }

  return account;
}

const handleConnectAccount = async (req, res) => {
  try {
    const { userId, login, password, server, name, email, fullName } = req.body;
    const user = findOrCreateUser(userId, email, fullName);

    // Allow connection since user tier is defaulted/forced to Gold
    const account = await getOrCreateAccount(login, password, server, name);

    user.mt5Connected = true;
    user.mt5Locked = true;
    user.mt5Account = { login: String(login), server, accountId: account.id };

    res.json({ success: true, accountId: account.id, state: account.state, account });
  } catch (error) {
    console.error('Connect Error:', error);
    res.status(500).json({ error: error.message || 'Failed to connect account.' });
  }
};

const handleGetAccountInfo = async (req, res) => {
  try {
    const accounts = await api.metatraderAccountApi.getAccounts();
    const account = accounts.find(a => a.state === 'DEPLOYED') || accounts[0];

    if (!account) {
      return res.json({ balance: 0, equity: 0, currency: 'USD', state: 'DISCONNECTED' });
    }

    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    const info = await connection.getAccountInformation();
    res.json(info);
  } catch (error) {
    res.json({ balance: 0, equity: 0, currency: 'USD' });
  }
};

const handleGetTrades = async (req, res) => {
  try {
    const accounts = await api.metatraderAccountApi.getAccounts();
    const account = accounts.find(a => a.state === 'DEPLOYED') || accounts[0];

    if (!account) {
      return res.json({ positions: [], liveTrades: [], closedTrades: [] });
    }

    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    const positions = await connection.getPositions();
    res.json({ positions, liveTrades: positions, closedTrades: [] });
  } catch (error) {
    res.json({ positions: [], liveTrades: [], closedTrades: [] });
  }
};

const handleGetSignals = (req, res) => {
  const symbol = req.query.symbol || 'XAUUSD';
  res.json({
    success: true,
    symbol,
    type: 'BUY',
    entry: '2,638.16 - 2,639.55',
    stopLoss: '2,631.18',
    tp1: '2,641.96',
    tp2: '2,647.14',
    status: 'Active'
  });
};

const handleGetAnalysis = (req, res) => {
  const symbol = req.query.symbol || 'XAUUSD';
  res.json({
    success: true,
    symbol,
    h1Sweep: { status: 'Confirmed', detail: 'CRT-Low raided at 2,635.62, closed back inside' },
    vwap: { status: 'Confirmed', val: '2,637.51', vwap: '2,641.46', vah: '2,643.18' },
    delta: { status: 'Waiting', cumulativeDelta: '-760' },
    crtHigh: '2,644.29',
    crtLow: '2,638.84',
    m5Atr: '3.56'
  });
};

app.post('/api/connect-user', handleConnectAccount);
app.post('/connect-account', handleConnectAccount);
app.get('/api/account-info', handleGetAccountInfo);
app.get('/api/account', handleGetAccountInfo);
app.get('/api/trades', handleGetTrades);
app.get('/api/positions', handleGetTrades);
app.get('/api/signals', handleGetSignals);
app.get('/api/analyze', handleGetAnalysis);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
