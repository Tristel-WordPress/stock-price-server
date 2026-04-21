import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally before importing the module
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after stubbing fetch
const { fetchStockPrice, cache, previousPrices } = await import("./server.js");

function makeFetchResponse(body, ok = true) {
	return {
		ok,
		json: async () => body
	};
}

describe("fetchStockPrice", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cache.flushAll();
		previousPrices.clear();
		process.env.TWELVE_DATA_API_KEY = "test-key";
	});

	afterEach(() => {
		delete process.env.TWELVE_DATA_API_KEY;
	});

	it("returns price data from upstream API", async () => {
		mockFetch.mockResolvedValueOnce(makeFetchResponse({ price: "123.45" }));

		const result = await fetchStockPrice({
			symbol: "TSTL",
			apiSymbol: "TSTL:LSE",
			exchange: "LSE",
			currency: "GBP"
		});

		expect(result).toEqual({
			symbol: "TSTL", exchange: "LSE", price: 123.45, currency: "GBP", cached: false,
			previousPrice: null, change: null, changePercent: null, direction: null
		});
	});

	it("returns cached result on second call", async () => {
		mockFetch.mockResolvedValueOnce(makeFetchResponse({ price: "99.00" }));

		await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });
		const result = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(result.cached).toBe(true);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("throws 500 with MISSING_API_KEY code when API key is missing", async () => {
		delete process.env.TWELVE_DATA_API_KEY;

		await expect(
			fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" })
		).rejects.toMatchObject({ message: "Missing TWELVE_DATA_API_KEY", status: 500, code: "MISSING_API_KEY" });
	});

	it("throws 502 with UPSTREAM_ERROR code and upstream details when API returns error", async () => {
		mockFetch.mockResolvedValueOnce(
			makeFetchResponse({ status: "error", code: 401, message: "Invalid API key" }, false)
		);

		await expect(
			fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" })
		).rejects.toMatchObject({ status: 502, code: "UPSTREAM_ERROR", upstream: { code: 401, status: "error" } });
	});

	it("throws 502 with INVALID_PRICE code when price is missing from response", async () => {
		mockFetch.mockResolvedValueOnce(makeFetchResponse({ price: null }));

		await expect(
			fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" })
		).rejects.toMatchObject({ status: 502, code: "INVALID_PRICE" });
	});

	it("throws 504 with TIMEOUT code on request timeout", async () => {
		const abortError = new DOMException("The operation was aborted", "AbortError");
		mockFetch.mockRejectedValueOnce(abortError);

		await expect(
			fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" })
		).rejects.toMatchObject({ status: 504, code: "TIMEOUT", message: expect.stringContaining("timed out") });
	});

	it("throws 502 with NETWORK_ERROR code on network failure", async () => {
		const networkError = Object.assign(new TypeError("fetch failed"), {
			cause: new Error("ECONNREFUSED")
		});
		mockFetch.mockRejectedValueOnce(networkError);

		await expect(
			fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" })
		).rejects.toMatchObject({ status: 502, code: "NETWORK_ERROR", message: expect.stringContaining("Network error") });
	});

	it("returns null change fields on first fetch for a symbol", async () => {
		mockFetch.mockResolvedValueOnce(makeFetchResponse({ price: "100.00" }));

		const result = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(result.previousPrice).toBeNull();
		expect(result.change).toBeNull();
		expect(result.changePercent).toBeNull();
		expect(result.direction).toBeNull();
	});

	it("returns correct delta fields on second fresh fetch", async () => {
		mockFetch
			.mockResolvedValueOnce(makeFetchResponse({ price: "100.00" }))
			.mockResolvedValueOnce(makeFetchResponse({ price: "105.00" }));

		await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });
		cache.flushAll();
		const result = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(result.previousPrice).toBe(100);
		expect(result.change).toBeCloseTo(5);
		expect(result.changePercent).toBeCloseTo(5);
		expect(result.direction).toBe("up");
	});

	it("sets direction to down when price falls", async () => {
		mockFetch
			.mockResolvedValueOnce(makeFetchResponse({ price: "200.00" }))
			.mockResolvedValueOnce(makeFetchResponse({ price: "190.00" }));

		await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });
		cache.flushAll();
		const result = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(result.change).toBeCloseTo(-10);
		expect(result.direction).toBe("down");
	});

	it("sets direction to flat when price is unchanged", async () => {
		mockFetch
			.mockResolvedValueOnce(makeFetchResponse({ price: "150.00" }))
			.mockResolvedValueOnce(makeFetchResponse({ price: "150.00" }));

		await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });
		cache.flushAll();
		const result = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(result.change).toBe(0);
		expect(result.direction).toBe("flat");
	});

	it("cached response includes delta from time of caching", async () => {
		mockFetch
			.mockResolvedValueOnce(makeFetchResponse({ price: "100.00" }))
			.mockResolvedValueOnce(makeFetchResponse({ price: "110.00" }));

		await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });
		cache.flushAll();
		await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		// Third call — should hit cache and return the delta from the second fetch
		const cached = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });
		expect(cached.cached).toBe(true);
		expect(cached.previousPrice).toBe(100);
		expect(cached.change).toBeCloseTo(10);
		expect(cached.direction).toBe("up");
	});
});
