require('dotenv').config();
const express = require('express');
const cors = require('cors');
const MetaApi = require('metaapi.cloud-sdk').default;

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

// Your exact Admin Email
const ADMIN_EMAIL = 'henrymvungi20@gmail.com'; 

const users = [
  {
    id: 'usr_demo_1',
    fullName: 'Henry Mvungi',
    email: 'henrymvungi20@gmail.com',
    phoneNumber: '+255000000000',
    country: 'Tanzania',
    tier: 'vecto2',
    status: 'active',
    mt5Connected: true,
    mt5Locked: true,
    mt5Account: { login: '101236718', server: 'DerivSVG-Server-02' }
  }
];

const findUser = (id) => users.find(u => u.id === id);

app.get('/', (req, res) => {
  res.send('Vector Backend is live');
});

// ==========================================
// 1. AUTHENTICATION & SIGN-UP
// ==========================================
app.post('/api/auth/signup', (req, res) => {
  const { fullName, email, phoneNumber, country } = req.body;
  if (!fullName || !email || !phoneNumber || !country) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    user = {
      id: `usr_${Date.now()}`,
      fullName,
      email,
      phoneNumber,
      country,
      tier: 'free',
      status: 'active',
      mt5Connected: false,
      mt5Locked: false,
      mt5Account: null
    };
    users.push(user);
  }

  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  res.json({ success: true, user, isAdmin });
});

// ==========================================
// 2. ADMIN ENDPOINTS (Strictly Locked to You)
// ==========================================
app.get('/api/admin/users', (req, res) => {
  const requesterEmail = req.query.email || req.headers['x-user-email'];
  if (!requesterEmail || requesterEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  res.json({ success: true, users });
});

app.post('/api/admin/disconnect-mt5', (req, res) => {
  const { userId, adminEmail } = req.body;
  if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const user = findUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  user.mt5Connected = false;
  user.mt5Locked = false;
  user.mt5Account = null;

  res.json({ success: true, message: 'MT5 account unlinked successfully.', user });
});

app.post('/api/admin/toggle-status', (req, res) => {
  const { userId, status, adminEmail } = req.body;
  if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const user = findUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  user.status = status; 
  res.json({ success: true, user });
});

app.delete('/api/admin/delete-user/:id', (req, res) => {
  const adminEmail = req.query.adminEmail || req.headers['x-user-email'];
  if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const index = users.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'User not found.' });

  users.splice(index, 1);
  res.json({ success: true, message: 'User account permanently deleted.' });
});

// ==========================================
// 3. TRADING & METAAPI ENGINE
// ==========================================
async function getOrCreateAccount(login, password, server, name) {
  const accountApi = api.metatraderAccountApi;
  const accounts = await accountApi.getAccounts();
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
    const { userId, login, password, server, name } = req.body;
    const user = findUser(userId);

    if (user && user.mt5Locked) {
      return res.status(403).json({ error: 'MT5 account is permanently locked. Only Admin can disconnect it.' });
    }

    const account = await getOrCreateAccount(login, password, server, name);

    if (user) {
      user.mt5Connected = true;
      user.mt5Locked = true;
      user.mt5Account = { login: String(login), server, accountId: account.id };
    }

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
