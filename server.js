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

app.get('/', (req, res) => {
  res.send('Vector Backend is live');
});

// Create/Deploy Account
const handleConnectAccount = async (req, res) => {
  try {
    const { login, password, server, name } = req.body;
    if (!login || !password || !server) {
      return res.status(400).json({ error: 'Missing required credentials.' });
    }

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

    res.json({ success: true, accountId: account.id, state: account.state });
  } catch (error) {
    console.error('Connect Error:', error);
    res.status(500).json({ error: error.message || 'Failed to connect account.' });
  }
};

// Safe Get Trades / Positions
const handleGetTrades = async (req, res) => {
  try {
    const accounts = await api.metatraderAccountApi.getAccounts();
    const deployedAccount = accounts.find(a => a.state === 'DEPLOYED');

    if (!deployedAccount) {
      return res.json({ positions: [], liveTrades: [], closedTrades: [] });
    }

    const connection = deployedAccount.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    const positions = await connection.getPositions();
    res.json({ positions, liveTrades: positions, closedTrades: [] });
  } catch (error) {
    console.error('Trades Error:', error);
    res.json({ positions: [], liveTrades: [], closedTrades: [] });
  }
};

// Safe Get Account Info
const handleGetAccountInfo = async (req, res) => {
  try {
    const accounts = await api.metatraderAccountApi.getAccounts();
    const deployedAccount = accounts.find(a => a.state === 'DEPLOYED');

    if (!deployedAccount) {
      return res.json({ balance: 0, equity: 0, currency: 'USD' });
    }

    const connection = deployedAccount.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    const info = await connection.getAccountInformation();
    res.json(info);
  } catch (error) {
    console.error('Account Info Error:', error);
    res.json({ balance: 0, equity: 0, currency: 'USD' });
  }
};

app.post('/api/connect-user', handleConnectAccount);
app.post('/connect-account', handleConnectAccount);

app.get('/api/trades', handleGetTrades);
app.get('/api/positions', handleGetTrades);
app.get('/trades', handleGetTrades);

app.get('/api/account-info', handleGetAccountInfo);
app.get('/api/account', handleGetAccountInfo);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
