import { useEffect, useState } from 'react';
import './stock-info-component.scss';

const StockInfoComponent = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		async function fetchStockInfo() {
			try {
				const endpoint =
					'https://stock-price-server-production.up.railway.app/api/v1/stock-price';

				if (!endpoint) {
					throw new Error('Stock info endpoint is not configured.');
				}

				const response = await fetch(endpoint);

				if (!response.ok) {
					throw new Error('Failed to fetch stock data.');
				}

				setData(await response.json());
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

	const direction = data.direction === 'up' ? 'up' : data.direction === 'down' ? 'down' : 'natural';
	const changeSign = direction === 'up' ? '+' : '';
	const changePercentFormatted = data.changePercent.toFixed(2);

	return (
		<div className="stock-info-component">
			<div>
				<span className="stock-info-component__symbol">
					{data.symbol}
				</span>
				<span className="stock-info-component__exchange">
					{data.exchange}
				</span>
				<span className="stock-info-component__price">
					{data.price.toFixed(2)}
					<span className="stock-info-component__currency">
						{data.currency}
					</span>
				</span>
				<span className={`stock-info-component__change stock-info-component__change--${direction}`}>
					{changeSign}{data.change.toFixed(2)} ({changeSign}{changePercentFormatted}%)
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
				{direction === 'natural' ? (
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
