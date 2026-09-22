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

// Initialize MetaApi SDK
const token = process.env.META_API_TOKEN;
const metaApi = new MetaApi(token);

// Root test route
app.get('/', (req, res) => {
  res.send('Vector Backend is live');
});

// Shared Account Connection Handler
const handleConnectAccount = async (req, res) => {
  try {
    const { login, password, server, name } = req.body;

    if (!login || !password || !server) {
      return res.status(400).json({ error: 'Missing required account credentials (login, password, server).' });
    }

    // Access MetaTrader Account API instance
    const accountApi = metaApi.metatraderAccountApi;
    
    // Fetch user accounts
    let account;
    try {
      const accounts = await accountApi.getAccounts();
      account = accounts.find(a => String(a.login) === String(login) && a.server === server);
    } catch (e) {
      console.log('Fetching accounts list failed or empty, attempting direct create/get...');
    }

    // Create account if not already connected
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

    res.json({ success: true, accountId: account.id, account });
  } catch (error) {
    console.error('MetaApi Error:', error);
    res.status(500).json({ error: error.message || 'Failed to connect account.' });
  }
};

// Route handlers matching Lovable endpoints
app.post('/api/connect-user', handleConnectAccount);
app.post('/connect-account', handleConnectAccount);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
