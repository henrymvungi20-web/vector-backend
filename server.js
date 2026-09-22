require('dotenv').config();
const express = require('express');
const cors = require('cors');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();

app.use(express.json());
app.use(cors());

// Custom CORS Headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const token = process.env.META_API_TOKEN;
const api = new MetaApi(token);

// In-Memory Database Store for Users & Tiers
const users = [
  {
    id: 'usr_demo_1',
    fullName: 'Henry Mvungi',
    email: 'admin@vector.ai',
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

  let user = users.find(u => u.email === email);
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

  res.json({ success: true, user });
});

// ==========================================
// 2. ADMIN ENDPOINTS (Fixes Lovable 404)
// ==========================================
app.get('/api/admin/users', (req, res) => {
  res.json({ success: true, users });
});

app.post('/api/admin/disconnect-mt5', (req, res) => {
  const { userId } = req.body;
  const user = findUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  user.mt5Connected = false;
  user.mt5Locked = false;
  user.mt5Account = null;

  res.json({ success: true, message: 'MT5 account unlinked by admin.', user });
});

app.post('/api/admin/toggle-status', (req, res) => {
  const { userId, status } = req.body;
  const user = findUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  user.status = status;
  res.json({ success: true, user });
});

app.delete('/api/admin/delete-user/:id', (req, res) => {
  const index = users.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'User not found.' });

  users.splice(index, 1);
  res.json({ success: true, message: 'User deleted.' });
});

// ==========================================
// 3. MT5 & TRADING ENGINE ENDPOINTS
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
    const { login, password, server, name } = req.body;
    if (!login || !password || !server) {
      return res.status(400).json({ error: 'Missing account credentials.' });
    }

    const account = await getOrCreateAccount(login, password, server, name);
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
    symbol: symbol,
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
    symbol: symbol,
    h1Sweep: { status: 'Confirmed', detail: 'CRT-Low raided at 2,635.62, closed back inside' },
    vwap: { status: 'Confirmed', val: '2,637.51', vwap: '2,641.46', vah: '2,643.18' },
    delta: { status: 'Waiting', cumulativeDelta: '-760' },
    crtHigh: '2,644.29',
    crtLow: '2,638.84',
    m5Atr: '3.56'
  });
};

// Route Registrations
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
