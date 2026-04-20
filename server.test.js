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
		mockFetch.mockResolvedValueOnce(makeFetchResponse({ price: "123.45" }));

		const result = await fetchStockPrice({
			symbol: "TSTL",
			apiSymbol: "TSTL:LSE",
			exchange: "LSE",
			currency: "GBP"
		});

		expect(result).toEqual({ symbol: "TSTL", exchange: "LSE", price: 123.45, currency: "GBP", cached: false });
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
});
