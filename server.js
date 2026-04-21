import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import { NodeCache } from "@cacheable/node-cache";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CACHE_TTL = parseInt(process.env.CACHE_TTL || "3600", 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "30", 10);

export const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: CACHE_TTL * 2 });
export const previousPrices = new Map();


if (process.env.NODE_ENV !== 'production') {
	process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
}

// Middleware
app.use(helmet());
app.use(
	cors({
		origin: process.env.CORS_ORIGIN?.split(",") || "http://localhost:3001"
	})
);
app.use(express.json({ limit: "10kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Rate limiting
app.use(
	"/api/",
	rateLimit({
		windowMs: RATE_LIMIT_WINDOW_MS,
		limit: RATE_LIMIT_MAX,
		standardHeaders: true,
		legacyHeaders: false
	})
);

/**
 * Fetches a stock price from Twelve Data with caching.
 * @param {{ symbol: string, apiSymbol: string, exchange: string, currency: string }} opts
 */
export async function fetchStockPrice({ symbol, apiSymbol, exchange, currency }) {
	const cacheKey = `stock:${symbol}`;
	const cached = cache.get(cacheKey);

	const previousPrice = previousPrices.get(symbol) ?? null;

	function buildDelta(price) {
		const change = previousPrice !== null ? price - previousPrice : null;
		const changePercent = change !== null ? (change / previousPrice) * 100 : null;
		const direction = change === null ? null : change > 0 ? "up" : change < 0 ? "down" : "flat";
		return { previousPrice, change, changePercent, direction };
	}

	if (cached) {
		return { ...cached, ...buildDelta(cached.price), cached: true };
	}

	const apiKey = process.env.TWELVE_DATA_API_KEY;

	if (!apiKey) {
		const err = new Error("Missing TWELVE_DATA_API_KEY");
		err.status = 500;
		err.code = "MISSING_API_KEY";
		throw err;
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);

	let response, data;
	try {
		response = await fetch(
			`https://api.twelvedata.com/price?symbol=${apiSymbol}&apikey=${apiKey}`,
			{ signal: controller.signal }
		);
		data = await response.json();
	} catch (error) {
		if (error.name === "AbortError") {
			const err = new Error(`Upstream API request timed out for ${symbol}`);
			err.status = 504;
			err.code = "TIMEOUT";
			throw err;
		}
		const err = new Error(`Network error fetching ${symbol}: ${error.cause?.message ?? error.message}`);
		err.status = 502;
		err.code = "NETWORK_ERROR";
		throw err;
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok || data.status === "error") {
		console.error(`Upstream error for ${symbol}:`, data);
		const err = new Error(data.message || "Upstream API returned an error");
		err.status = 502;
		err.code = "UPSTREAM_ERROR";
		err.upstream = { code: data.code, status: data.status };
		throw err;
	}

	const price = Number(data.price);
	if (!data.price || isNaN(price)) {
		const err = new Error("Invalid price received from upstream API");
		err.status = 502;
		err.code = "INVALID_PRICE";
		throw err;
	}

	previousPrices.set(symbol, price);

	const payload = { symbol, exchange, price, currency };
	cache.set(cacheKey, payload);
	return { ...payload, ...buildDelta(price), cached: false };
}

// Route handler helper
function stockHandler(opts) {
	return async (_req, res) => {
		try {
			const result = await fetchStockPrice(opts);
			return res.json(result);
		} catch (error) {
			console.error(`Stock fetch error [${opts.symbol}]:`, error.message, { code: error.code, upstream: error.upstream });
			const body = {
				error: error.message || "Server error",
				code: error.code || "INTERNAL_ERROR",
				symbol: opts.symbol,
				...(error.upstream && { upstream: error.upstream })
			};
			return res.status(error.status || 500).json(body);
		}
	};
}

/**
 * LSE stock: TSTL
 */
app.get("/api/v1/stock-price", stockHandler({
	symbol: "TSTL",
	apiSymbol: "TSTL:LSE",
	exchange: "LSE",
	currency: "GBP"
}));

/**
 * Test endpoint: NVDA (NASDAQ)
 */
app.get("/api/v1/test", stockHandler({
	symbol: "NVDA",
	apiSymbol: "NVDA",
	exchange: "NASDAQ",
	currency: "USD"
}));

/**
 * Health check
 */
app.get("/health", (_req, res) => {
	res.json({ ok: true, uptime: process.uptime(), cacheKeys: cache.keys().length });
});

// Graceful shutdown
const server = app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});

const shutdown = () => {
	server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
