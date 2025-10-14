# Riot API Proxy Server Setup

This proxy server allows your application to make Riot API requests without exposing your API key to the client.

## Setup Instructions

1. **Get a Riot API Key**
   - Visit [Riot Developer Portal](https://developer.riotgames.com/)
   - Sign in with your League of Legends account
   - Generate a development API key

2. **Configure Environment Variables**
   - Copy `.env.example` to `.env` in the project root:
     ```bash
     cp .env.example .env
     ```
   - Add your Riot API key to the `.env` file:
     ```
     VITE_RIOT_API_KEY=your_riot_api_key_here
     ```

3. **Install Dependencies**
   ```bash
   cd proxy-server
   npm install
   ```

4. **Start the Proxy Server**
   ```bash
   npm start
   ```
   
   The server will run on `http://localhost:3001`

5. **Configure Your Summoner Name**
   - Open `src/SummonersRift/SummonersRift.tsx`
   - Find the `GameCard` component
   - Update the game name and tag line:
     ```typescript
     const data = await getLatestGame('YourGameName', 'NA1')
     ```
   - Replace `'YourGameName'` with your Riot ID game name
   - Replace `'NA1'` with your tag line

## Development Mode

For auto-reloading during development:
```bash
npm run dev
```

## Testing the Proxy

Check if the server is running:
```bash
curl http://localhost:3001/health
```

You should see:
```json
{"status":"ok","message":"Proxy server is running"}
```

## Troubleshooting

### CORS Errors
- Make sure the proxy server is running
- Check that `USE_PROXY` is set to `true` in `src/SummonersRift/riotApi.ts`

### API Key Issues
- Verify your API key is correctly set in `.env`
- Development keys expire after 24 hours - generate a new one daily
- Check the console logs in the proxy server for detailed error messages

### Rate Limiting
- Development keys have strict rate limits (20 requests per second, 100 per 2 minutes)
- The proxy server logs all requests - check if you're hitting limits

## API Endpoints

The proxy server forwards requests to:
- Account API: Get player PUUID and account info
- Summoner API: Get summoner data
- Match API: Get match history and match details

All requests are made through: `http://localhost:3001/api/riot/{riot-api-path}`
