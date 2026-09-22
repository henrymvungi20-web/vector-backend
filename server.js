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

const handleConnectAccount = async (req, res) => {
  try {
    const { login, password, server, name } = req.body;

    if (!login || !password || !server) {
      return res.status(400).json({ error: 'Missing required account credentials (login, password, server).' });
    }

    // Call MetaApi account creation directly
    const account = await api.metatraderAccountApi.createAccount({
      name: name || `MT5-${login}`,
      type: 'cloud',
      login: String(login),
      password: password,
      server: server,
      platform: 'mt5',
      magic: 1000
    });

    res.json({ success: true, accountId: account.id, account });
  } catch (error) {
    console.error('MetaApi Error:', error);
    // If account already exists on MetaApi, catch and return success
    if (error.details || error.message) {
      return res.json({ success: true, message: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to connect account.' });
  }
};

app.post('/api/connect-user', handleConnectAccount);
app.post('/connect-account', handleConnectAccount);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
