import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import StockHistoryChart from "../components/stock-history-chart/stock-history-chart";

const apiBase =
	typeof stock_history_params !== "undefined"
		? stock_history_params.apiBase
		: "https://stock-price-server-production.up.railway.app";

const StockHistory = () => (
	<StrictMode>
		<StockHistoryChart apiBase={apiBase} />
	</StrictMode>
);

export default StockHistory;

const rootElement = document.getElementById("stock-history");
if (rootElement) {
	ReactDOM.createRoot(rootElement).render(<StockHistory />);
}
