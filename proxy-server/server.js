const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

const RIOT_API_KEY = process.env.VITE_RIOT_API_KEY || '';

if (!RIOT_API_KEY) {
  console.error('⚠️  WARNING: VITE_RIOT_API_KEY not found in environment variables');
  console.error('Please create a .env file in the project root with your Riot API key');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Proxy endpoint for Riot API requests
app.get('/api/riot/*', async (req, res) => {
  try {
    const riotPath = req.params[0];
    const queryString = req.url.split('?')[1] || '';
    const fullUrl = `https://${riotPath}${queryString ? '?' + queryString : ''}`;
    
    console.log(`Proxying request to: ${fullUrl}`);
    
    const response = await fetch(fullUrl, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`Riot API error: ${response.status}`, data);
      return res.status(response.status).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy server error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Riot API Proxy Server running on http://localhost:${PORT}`);
  console.log(`✅ API Key loaded: ${RIOT_API_KEY ? 'Yes' : 'No'}`);
});
