# stock-price-server

A lightweight Express.js proxy API that serves stock prices from [Twelve Data](https://twelvedata.com/), with in-memory caching and rate limiting.

## Setup

```bash
cp .env.example .env
# Fill in TWELVE_DATA_API_KEY in .env
npm install
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port to listen on |
| `TWELVE_DATA_API_KEY` | *(required)* | Twelve Data API key |
| `CORS_ORIGIN_PROD` | — | Allowed origin for production (e.g. `https://example.com`) |
| `CORS_ORIGIN_TEST` | — | Allowed origin for testing (e.g. `http://localhost:5173`) |
| `CACHE_TTL` | `30` | Cache TTL in seconds |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in ms |
| `RATE_LIMIT_MAX` | `30` | Max requests per window per IP |
| `NODE_ENV` | — | Set to `production` for combined log format |

## Endpoints

### `GET /health`
Returns server health and basic stats.
```json
{ "ok": true, "uptime": 42.3, "cacheKeys": 1 }
```

### `GET /api/v1/stock-price`
Returns the current price for **TSTL** (Tissue Regenix, LSE).
```json
{
  "symbol": "TSTL",
  "exchange": "LSE",
  "price": 387.5,
  "currency": "GBP",
  "cached": false
}
```
### `GET /api/v1/test`
Returns the current price for **NVDA** (NVIDIA, NASDAQ).
```json
{
  "symbol": "TSTL",
  "exchange": "LSE",
  "price": 380,
  "currency": "GBP",
  "previousPrice": 387.5,
  "change": -7.5,
  "changePercent": -1.93548,
  "direction": "down",
  "cached": true
}
```

The `cached` field is `true` when the response was served from cache (30-second TTL by default).

## Development

```bash
npm run dev    # start with auto-reload
npm test       # run tests
```
