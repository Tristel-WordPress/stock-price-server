import { useState, useEffect, useCallback } from "react";

const CURRENCY_SYMBOLS = { GBP: "£", USD: "$", EUR: "€" };

function formatPrice(price, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${symbol}${price.toFixed(2)}`;
}

export default function StockPrice({ apiUrl = "/api/v1/stock-price", refreshInterval = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchPrice = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(apiUrl);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchPrice();
    if (refreshInterval > 0) {
      const id = setInterval(fetchPrice, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchPrice, refreshInterval]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Stock Price</span>
        <button onClick={fetchPrice} style={styles.refreshBtn} aria-label="Refresh">
          &#x21bb;
        </button>
      </div>

      {loading && !data && (
        <p style={styles.muted}>Loading&hellip;</p>
      )}

      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && (
        <div style={styles.body}>
          <div style={styles.priceRow}>
            <span style={styles.symbol}>{data.symbol}</span>
            <span style={styles.price}>{formatPrice(data.price, data.currency)}</span>
          </div>
          <div style={styles.meta}>
            <span style={styles.badge}>{data.exchange}</span>
            <span style={styles.badge}>{data.currency}</span>
            {data.cached && <span style={{ ...styles.badge, ...styles.cachedBadge }}>Cached</span>}
          </div>
          {lastUpdated && (
            <p style={styles.timestamp}>
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    fontFamily: "system-ui, sans-serif",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px 24px",
    maxWidth: "320px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    background: "#fff",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  title: {
    fontSize: "13px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#64748b",
  },
  refreshBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
    color: "#94a3b8",
    lineHeight: 1,
    padding: "2px 4px",
    borderRadius: "4px",
  },
  priceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "12px",
  },
  symbol: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#0f172a",
  },
  price: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#0f172a",
    fontVariantNumeric: "tabular-nums",
  },
  meta: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    marginBottom: "10px",
  },
  badge: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#475569",
  },
  cachedBadge: {
    background: "#fef9c3",
    color: "#854d0e",
  },
  timestamp: {
    fontSize: "11px",
    color: "#94a3b8",
    margin: 0,
  },
  muted: {
    color: "#94a3b8",
    margin: 0,
  },
  error: {
    fontSize: "13px",
    color: "#b91c1c",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "8px 12px",
  },
};
