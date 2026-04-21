import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally before importing the module
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after stubbing fetch
const { fetchStockPrice, cache } = await import("./server.js");

function makeFetchResponse(body, ok = true) {
	return {
		ok,
		json: async () => body
	};
}

function makeQuoteResponse(close, change, percentChange, previousClose) {
	return makeFetchResponse({
		close: String(close),
		change: String(change),
		percent_change: String(percentChange),
		previous_close: String(previousClose)
	});
}

describe("fetchStockPrice", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cache.flushAll();
		process.env.TWELVE_DATA_API_KEY = "test-key";
	});

	afterEach(() => {
		delete process.env.TWELVE_DATA_API_KEY;
	});

	it("returns price data from upstream API", async () => {
		mockFetch.mockResolvedValueOnce(makeQuoteResponse("123.45", "0.50", "0.41", "122.95"));

		const result = await fetchStockPrice({
			symbol: "TSTL",
			apiSymbol: "TSTL:LSE",
			exchange: "LSE",
			currency: "GBP"
		});

		expect(result).toEqual({
			symbol: "TSTL", exchange: "LSE", price: 123.45, currency: "GBP", cached: false,
			previousPrice: 122.95, change: 0.50, changePercent: 0.41, direction: "up"
		});
	});

	it("calls the /quote endpoint", async () => {
		mockFetch.mockResolvedValueOnce(makeQuoteResponse("99.00", "1.00", "1.02", "98.00"));

		await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("twelvedata.com/quote"),
			expect.anything()
		);
	});

	it("returns cached result on second call", async () => {
		mockFetch.mockResolvedValueOnce(makeQuoteResponse("99.00", "1.00", "1.02", "98.00"));

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
		mockFetch.mockResolvedValueOnce(makeFetchResponse({ close: null }));

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

	it("returns delta fields sourced from the API response", async () => {
		mockFetch.mockResolvedValueOnce(makeQuoteResponse("105.00", "5.00", "5.00", "100.00"));

		const result = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(result.previousPrice).toBe(100);
		expect(result.change).toBeCloseTo(5);
		expect(result.changePercent).toBeCloseTo(5);
		expect(result.direction).toBe("up");
	});

	it("sets direction to down when change is negative", async () => {
		mockFetch.mockResolvedValueOnce(makeQuoteResponse("190.00", "-10.00", "-5.00", "200.00"));

		const result = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(result.change).toBeCloseTo(-10);
		expect(result.direction).toBe("down");
	});

	it("sets direction to flat when change is zero", async () => {
		mockFetch.mockResolvedValueOnce(makeQuoteResponse("150.00", "0.00", "0.00", "150.00"));

		const result = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(result.change).toBe(0);
		expect(result.direction).toBe("flat");
	});

	it("cached response returns same delta as the original fetch", async () => {
		mockFetch.mockResolvedValueOnce(makeQuoteResponse("110.00", "10.00", "10.00", "100.00"));

		await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });
		const cached = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(cached.cached).toBe(true);
		expect(cached.previousPrice).toBe(100);
		expect(cached.change).toBeCloseTo(10);
		expect(cached.direction).toBe("up");
	});

	it("returns null delta fields when API omits change data", async () => {
		mockFetch.mockResolvedValueOnce(makeFetchResponse({ close: "123.45" }));

		const result = await fetchStockPrice({ symbol: "TSTL", apiSymbol: "TSTL:LSE", exchange: "LSE", currency: "GBP" });

		expect(result.previousPrice).toBeNull();
		expect(result.change).toBeNull();
		expect(result.changePercent).toBeNull();
		expect(result.direction).toBeNull();
	});
});
