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

// In-Memory Database Store (Replace with PostgreSQL/MongoDB in production)
const users = [];

// Helper: Find User by ID
const findUser = (id) => users.find(u => u.id === id);

// ==========================================
// 1. AUTHENTICATION & USER MANAGEMENT
// ==========================================

// Sign Up Route
app.post('/api/auth/signup', (req, res) => {
  const { fullName, email, phoneNumber, country } = req.body;

  if (!fullName || !email || !phoneNumber || !country) {
    return res.status(400).json({ error: 'All registration fields are required.' });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists with this email.' });
  }

  const newUser = {
    id: `usr_${Date.now()}`,
    fullName,
    email,
    phoneNumber,
    country,
    tier: 'free', // Options: 'free', 'vecto1', 'vecto2'
    status: 'active', // Options: 'active', 'suspended'
    mt5Connected: false,
    mt5Account: null, // { login, server, metaApiAccountId }
    mt5Locked: false,
    createdAt: new Date()
  };

  users.push(newUser);
  res.json({ success: true, user: newUser });
});

// Sign In Route
app.post('/api/auth/signin', (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'Account suspended. Please contact support.' });
  }

  res.json({ success: true, user });
});

// ==========================================
// 2. MT5 SINGLE ACCOUNT LOCKING LOGIC
// ==========================================

app.post('/api/connect-user', async (req, res) => {
  try {
    const { userId, login, password, server } = req.body;
    const user = findUser(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.tier === 'free') {
      return res.status(403).json({ error: 'Upgrade to Vecto 1 or Vecto 2 to connect MT5.' });
    }

    if (user.mt5Locked) {
      return res.status(403).json({ 
        error: 'MT5 account is permanently locked. Only Admin can change or disconnect your account.' 
      });
    }

    // Connect to MetaApi
    const accountApi = api.metatraderAccountApi;
    const accounts = await accountApi.getAccounts();
    let account = accounts.find(a => String(a.login) === String(login) && a.server === server);

    if (!account) {
      account = await accountApi.createAccount({
        name: `${user.fullName}-MT5`,
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

    // Lock account to user
    user.mt5Connected = true;
    user.mt5Locked = true;
    user.mt5Account = {
      login: String(login),
      server: server,
      metaApiAccountId: account.id
    };

    res.json({ success: true, accountId: account.id, user });
  } catch (error) {
    console.error('Connection Error:', error);
    res.status(500).json({ error: error.message || 'Failed to bind MT5 account.' });
  }
});

// ==========================================
// 3. ADMIN CONTROL ENDPOINTS
// ==========================================

// Get All Users (Admin)
app.get('/api/admin/users', (req, res) => {
  res.json({ success: true, users });
});

// Disconnect / Reset User MT5 Account (Admin Only)
app.post('/api/admin/disconnect-mt5', (req, res) => {
  const { userId } = req.body;
  const user = findUser(userId);

  if (!user) return res.status(404).json({ error: 'User not found.' });

  user.mt5Connected = false;
  user.mt5Locked = false;
  user.mt5Account = null;

  res.json({ success: true, message: 'MT5 account unlinked successfully.', user });
});

// Suspend / Activate User (Admin Only)
app.post('/api/admin/toggle-status', (req, res) => {
  const { userId, status } = req.body;
  const user = findUser(userId);

  if (!user) return res.status(404).json({ error: 'User not found.' });

  user.status = status; // 'active' or 'suspended'
  res.json({ success: true, user });
});

// Delete User Account (Admin Only)
app.delete('/api/admin/delete-user/:id', (req, res) => {
  const index = users.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'User not found.' });

  users.splice(index, 1);
  res.json({ success: true, message: 'User deleted successfully.' });
});

// Set User Subscription Tier (Admin Only)
app.post('/api/admin/set-tier', (req, res) => {
  const { userId, tier } = req.body; // 'free', 'vecto1', 'vecto2'
  const user = findUser(userId);

  if (!user) return res.status(404).json({ error: 'User not found.' });

  user.tier = tier;
  res.json({ success: true, user });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
