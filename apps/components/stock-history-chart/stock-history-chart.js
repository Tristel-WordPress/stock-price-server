import {useEffect, useState} from "react";
import PropTypes from "prop-types";
import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,} from "recharts";
import "./stock-history-chart.scss";

const ChartTooltip = ({ active, payload, label }) => {
	if (!active || !payload?.length) return null;
	return (
		<div className="stock-history-chart__tooltip">
			<p className="stock-history-chart__tooltip-label">{label}</p>
			<p className="stock-history-chart__tooltip-price">
				{Number(payload[0].value).toFixed(2)}
			</p>
		</div>
	);
};

ChartTooltip.propTypes = {
	active: PropTypes.bool,
	payload: PropTypes.array,
	label: PropTypes.string,
};

const StockHistoryChart = ({ apiBase }) => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		setLoading(true);
		setError(null);
		async function fetchHistory() {
			try {
				const url = `${apiBase}/api/v1/stock-history?interval=1day`;
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error("Failed to fetch stock history.");
				}
				setData(await response.json());
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}
		fetchHistory();
	}, [apiBase]);

	if (loading) {
		return (
			<div className="stock-history-chart">
				<div className="stock-history-chart__skeleton" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="stock-history-chart">
				<div className="stock-history-chart__header">
					<div className="stock-history-chart__title">
						<span className="stock-history-chart__label">
							Share Price History
						</span>
					</div>
				</div>
				<p className="stock-history-chart__error">{error}</p>
			</div>
		);
	}

	const values = data.values;
	const lastPrice = values[values.length - 1].close;
	const firstPrice = values[0].close;
	const periodChange = lastPrice - firstPrice;
	const periodChangePercent = (periodChange / firstPrice) * 100;
	const periodHigh = Math.max(...values.map((v) => v.close));
	const periodLow = Math.min(...values.map((v) => v.close));
	const isUp = periodChange >= 0;
	const chartColor = isUp ? "#008375" : "#820040";
	const changeSign = isUp ? "+" : "";

	return (
		<div className="stock-history-chart">
			<div className="stock-history-chart__header">
				<div className="stock-history-chart__title">
					<span className="stock-history-chart__symbol">{data.symbol}</span>
					<span className="stock-history-chart__label">
						Share Price History
					</span>
				</div>
			</div>

			<div className="stock-history-chart__stats">
				<div className="stock-history-chart__stat">
					<span className="stock-history-chart__stat-label">Last Price</span>
					<span className="stock-history-chart__stat-value">
						{lastPrice.toFixed(2)}
					</span>
				</div>
				<div className="stock-history-chart__stat">
					<span className="stock-history-chart__stat-label">Change</span>
					<span
						className={`stock-history-chart__stat-value stock-history-chart__stat-value--${
							isUp ? "up" : "down"
						}`}
					>
						{changeSign}
						{periodChange.toFixed(2)} ({changeSign}
						{periodChangePercent.toFixed(2)}%)
					</span>
				</div>
				<div className="stock-history-chart__stat">
					<span className="stock-history-chart__stat-label">Period High</span>
					<span className="stock-history-chart__stat-value">
						{periodHigh.toFixed(2)}
					</span>
				</div>
				<div className="stock-history-chart__stat">
					<span className="stock-history-chart__stat-label">Period Low</span>
					<span className="stock-history-chart__stat-value">
						{periodLow.toFixed(2)}
					</span>
				</div>
			</div>

			<div className="stock-history-chart__chart-wrap">
				<ResponsiveContainer width="100%" height="100%">
					<AreaChart
						data={values}
						margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
					>
						<defs>
							<linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
								<stop offset="95%" stopColor={chartColor} stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke="#f0f0f0"
							vertical={false}
						/>
						<XAxis
							dataKey="datetime"
							tick={{ fontSize: 11 }}
							tickLine={false}
						/>
						<YAxis
							domain={["auto", "auto"]}
							tick={{ fontSize: 11 }}
							tickLine={false}
							axisLine={false}
							width={60}
						/>
						<Tooltip content={<ChartTooltip />} />
						<Area
							type="monotone"
							dataKey="close"
							stroke={chartColor}
							strokeWidth={2}
							fill="url(#priceGradient)"
							dot={false}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
};

StockHistoryChart.propTypes = {
	apiBase: PropTypes.string,
};

StockHistoryChart.defaultProps = {
	apiBase: "",
};

export default StockHistoryChart;
