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

// Cache (30s TTL)
const cache = new NodeCache({ stdTTL: 30, checkperiod: 60 });

// Middleware
app.use(helmet());
app.use(
	cors({
		origin: process.env.CORS_ORIGIN?.split(",") || "*"
	})
);
app.use(express.json());
app.use(morgan("combined"));

// Rate limiting
const limiter = rateLimit({
	windowMs: 60 * 1000,
	limit: 30,
	standardHeaders: true,
	legacyHeaders: false
});

app.use("/api/", limiter);

/**
 * LSE STOCK (TSTL)
 */
app.get("/api/stock-price", async (_req, res) => {
	try {
		const cacheKey = "stock:TSTL";
		const cached = cache.get(cacheKey);

		if (cached) {
			return res.json({ ...cached, cached: true });
		}

		const apiKey = process.env.TWELVE_DATA_API_KEY;

		if (!apiKey) {
			return res.status(500).json({ error: "Missing TWELVE_DATA_API_KEY" });
		}

		const url = `https://api.twelvedata.com/price?symbol=TSTL.LON&apikey=${apiKey}`;
		console.log("Requesting LSE price...");

		const response = await fetch(url);
		const data = await response.json();

		if (!response.ok || data.status === "error") {
			return res.status(502).json({
				error: data.message || "Failed to fetch stock price",
				raw: data
			});
		}

		const payload = {
			symbol: "TSTL",
			exchange: "LSE",
			price: Number(data.price),
			currency: "GBP"
		};

		cache.set(cacheKey, payload);

		return res.json({ ...payload, cached: false });
	} catch (error) {
		console.error("LSE fetch error:", error);
		console.error("Cause:", error?.cause);

		return res.status(500).json({
			error: error.message || "Server error",
			cause: error?.cause?.message || null,
			code: error?.cause?.code || null
		});
	}
});

/**
 * TEST ENDPOINT (NVDA)
 */
app.get("/api/test", async (_req, res) => {
	try {
		const cacheKey = "stock:NVDA";
		const cached = cache.get(cacheKey);

		if (cached) {
			return res.json({ ...cached, cached: true });
		}

		const apiKey = process.env.TWELVE_DATA_API_KEY;

		if (!apiKey) {
			return res.status(500).json({ error: "Missing TWELVE_DATA_API_KEY" });
		}

		const url = `https://api.twelvedata.com/price?symbol=NVDA&apikey=${apiKey}`;
		console.log("Requesting NVDA test price...");

		const response = await fetch(url);
		const data = await response.json();

		if (!response.ok || data.status === "error") {
			return res.status(502).json({
				error: data.message || "Failed to fetch NVDA price",
				raw: data
			});
		}

		const payload = {
			symbol: "NVDA",
			exchange: "NASDAQ",
			price: Number(data.price),
			currency: "USD"
		};

		cache.set(cacheKey, payload);

		return res.json({ ...payload, cached: false });
	} catch (error) {
		console.error("Test fetch error:", error);
		console.error("Cause:", error?.cause);

		return res.status(500).json({
			error: error.message || "Server error",
			cause: error?.cause?.message || null,
			code: error?.cause?.code || null
		});
	}
});

/**
 * HEALTH CHECK
 */
app.get("/health", (_req, res) => {
	res.json({ ok: true });
});

// Start server
app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});