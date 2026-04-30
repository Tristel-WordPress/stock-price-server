import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import "./stock-info-component.scss";

const API_BASE = "https://stock-price-server-production.up.railway.app";

const formatTime = (datetimeStr) => {
	if (!datetimeStr) return "";
	const sep = datetimeStr.includes("T") ? "T" : " ";
	const timePart = datetimeStr.split(sep)[1] || datetimeStr;
	return timePart.substring(0, 5);
};

const MiniTooltip = ({ active, payload, label }) => {
	if (!active || !payload?.length) return null;
	return (
		<div className="stock-info-component__mini-tooltip">
			<p>{label ? formatTime(label) : ""}</p>
			<p>{Number(payload[0].value).toFixed(2)}</p>
		</div>
	);
};

MiniTooltip.propTypes = {
	active: PropTypes.bool,
	payload: PropTypes.array,
	label: PropTypes.string,
};

const StockInfoComponent = () => {
	const [data, setData] = useState(null);
	const [chartData, setChartData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		async function fetchStockInfo() {
			try {
				const [priceRes, historyRes] = await Promise.all([
					fetch(`${API_BASE}/api/v1/stock-price`),
					fetch(`${API_BASE}/api/v1/stock-history?interval=1h&outputsize=24`),
				]);

				if (!priceRes.ok) {
					throw new Error("Failed to fetch stock data.");
				}

				const priceData = await priceRes.json();
				setData(priceData);

				if (historyRes.ok) {
					const historyData = await historyRes.json();
					setChartData(historyData.values || null);
				}
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		fetchStockInfo();
	}, []);

	if (loading) {
		return (
			<div className="stock-info-component stock-info-component--loading">
				Loading
			</div>
		);
	}

	if (error) {
		return (
			<div className="stock-info-component stock-info-component--error">
				{error}
			</div>
		);
	}

	const direction =
		data.direction === "up"
			? "up"
			: data.direction === "down"
				? "down"
				: "natural";
	const changeSign = direction === "up" ? "+" : "";
	const changePercentFormatted = data.changePercent.toFixed(2);

	const chartColor =
		direction === "up"
			? "#008375"
			: direction === "down"
				? "#820040"
				: "#333333";

	return (
		<div className="stock-info-component">
			<div className="stock-info-component__info">
				<span className="stock-info-component__symbol">{data.symbol}</span>
				<span className="stock-info-component__exchange">{data.exchange}</span>
				<span className="stock-info-component__price">
					{data.price.toFixed(2)}
					<span className="stock-info-component__currency">
						{data.currency}
					</span>
				</span>
				<span
					className={`stock-info-component__change stock-info-component__change--${direction}`}
				>
					{changeSign}
					{data.change.toFixed(2)} ({changeSign}
					{changePercentFormatted}%){" "}
					<span className="stock-info-component__timeframe">24H</span>
				</span>
			</div>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className={`stock-info-component__arrow stock-info-component__arrow--${direction}`}
			>
				{direction === "natural" ? (
					<path d="M5 12h14" />
				) : (
					<>
						<path d="m5 12 7-7 7 7" />
						<path d="M12 19V5" />
					</>
				)}
			</svg>
		</div>
	);
};

export default StockInfoComponent;
