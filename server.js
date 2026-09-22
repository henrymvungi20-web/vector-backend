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
const api = new MetaApi(token);

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

    // Access MetaTrader Account API directly from the SDK instance
    const metaTraderAccountApi = api.metatraderAccountApi;
    
    // Retrieve accounts array
    const accounts = await metaTraderAccountApi.getAccounts();
    let account = accounts.find(a => String(a.login) === String(login) && a.server === server);

    // Create account if it doesn't already exist on MetaApi
    if (!account) {
      account = await metaTraderAccountApi.createAccount({
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

// Handle all endpoint variations sent by Lovable
app.post('/api/connect-user', handleConnectAccount);
app.post('/connect-account', handleConnectAccount);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
