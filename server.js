require('dotenv').config();
const express = require('express');
const cors = require('cors');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();

// Parse incoming JSON payloads (Fixes req.body undefined error)
app.use(express.json());
app.use(cors());

// Custom CORS Headers Middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});






// MetaApi Token
const token = process.env.META_API_TOKEN || "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiIzNjQzZjNkZjRmMWU5YWUzNzc1MmExNGI3YTI2OWU1ZiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibXQtbWFuYWdlci1hcGkiLCJtZXRob2RzIjpbIm10LW1hbmFnZXItYXBpOnJlc3Q6ZGVhbGluZzoqOioiLCJtdC1tYW5hZ2VyLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJiaWxsaW5nLWFwaSIsIm1ldGhvZHMiOlsiYmlsbGluZy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiMzY0M2YzZGY0ZjFlOWFlMzc3NTJhMTRiN2EyNjllNWYiLCJpYXQiOjE3ODk5NDE3NDV9.aK-3_AXkHzV8pQFTLz8p4RPXUI2Iw8elocdIkrLEjrhZIk_AOlY_uJEbM7R2tTGOWQTJQ4BjP67vquS-ccBaryT81r5_rqQSRZLYqV_PVLpyMk-ssB3PioHpfID0uZyhqUjw_Ur2e-VwnFR8Tb9j9Lzu638EwvLaUVF9HBmRaZiUlxNmkdi6lhZ1TLHhxZ0qjDJSBne2JPHpb8tQK2fUeLPihwa6OkNDYAliD9SFoZCBGQe3GjYNOIGkFBNW3QrKhm_hFZGKqMv99BjXPSxDbVFDaOz_a9f8BnnQd9-i2TlUq0ocJEMi-WbaWQiEoJBAubGYEDEmHX1eFszTwUeTpbGW7YjpV9cVyeXaYkoHwYL_mpRelim7f_aSQu-0fgWxG5m8By0j_nNcqvxrgumMfykXzOwZDNMIVv0phyvv2cDTIEXWbc_XHrUvZ39eSrsV2lcwqKIOgVoG-zu-Ep_MUeUHS1qexP511gyAU6JKvfYasqdyOicOljwoCquSGSkJ-OWq42FyU41u1cUVlPwJ-eZBn6yIgpBp2UH_YafzFBYUrIuZQ5sicSYNrKgODp0i_nm9gYb0ql0ol4ghP4RO8lXLPOmkQaSt5CExdYWMsL3M8kDOMr-NmgLvosI6c2_QPHAS-6hOl-eZa3wqCwTQiTsBWbUl__g16Du0pbStJUk";
const api = new MetaApi(token);

// Store connection state globally so /api/account-info can serve active data
let activeConnection = null;
let activeAccountData = null;

app.get('/', (req, res) => res.send('Vecto Backend Server Running'));

// 1. Provision / Connect MT5 Account
app.post('/api/connect-user', async (req, res) => {
  try {
    const { login, password, server } = req.body;
    console.log(`[CONNECT] Received request for MT5 Account: ${login}`);

    const cleanLogin = String(login).trim();
    const cleanPassword = String(password).trim();
    const cleanServer = String(server).trim();

    // Clear stale or broken account instances in MetaApi
    const accounts = await api.metatraderAccountApi.getAccounts();
    const existingAccount = accounts.find(a => a.login === cleanLogin);
    if (existingAccount) {
      console.log(`[CLEANUP] Removing existing instance for ${cleanLogin}...`);
      await existingAccount.remove();
    }

    // Provision new cloud terminal instance
    console.log('[PROVISION] Creating MetaApi account instance...');
    const account = await api.metatraderAccountApi.createAccount({
      name: `MT5-${cleanLogin}`,
      type: 'cloud',
      login: cleanLogin,
      password: cleanPassword,
      server: cleanServer,
      platform: 'mt5',
      application: 'MetaApi',
      magic: 1000
    });

    console.log('[DEPLOY] Deploying MetaApi instance...');
    await account.deploy();
    await account.waitConnected();

    console.log('[RPC] Connecting to RPC API...');
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    // Cache active connection
    activeConnection = connection;

    const info = await connection.getAccountInformation();

    activeAccountData = {
      balance: info.balance,
      equity: info.equity,
      margin: info.margin,
      freeMargin: info.freeMargin,
      leverage: info.leverage,
      currency: info.currency,
      broker: info.broker,
      server: account.server,
      login: cleanLogin
    };

    console.log('[SUCCESS] Account information loaded:', activeAccountData);

    res.json({
      success: true,
      data: activeAccountData,
      ...activeAccountData
    });

  } catch (err) {
    console.error('[ERROR] Connect failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Account Info Endpoint (Serves live balance, equity & currency to Lovable)
app.get('/api/account-info', async (req, res) => {
  try {
    if (!activeConnection) {
      if (activeAccountData) {
        return res.json({ success: true, data: activeAccountData, ...activeAccountData });
      }
      return res.status(404).json({ success: false, error: 'No active MT5 connection found.' });
    }

    const info = await activeConnection.getAccountInformation();

    activeAccountData = {
      balance: info.balance,
      equity: info.equity,
      margin: info.margin,
      freeMargin: info.freeMargin,
      currency: info.currency,
      broker: info.broker,
      server: info.server
    };

    res.json({
      success: true,
      data: activeAccountData,
      ...activeAccountData
    });

  } catch (err) {
    console.error('[ERROR] Account info fetch failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
