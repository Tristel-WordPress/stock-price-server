import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import StockInfoComponent from '../components/stock-info-component/stock-info-component';

const StockInfo = () => {
	return (
		<StrictMode>
			<StockInfoComponent />
		</StrictMode>
	);
};
export default StockInfo;

const rootElement = document.getElementById('stock-info');
if (rootElement) {
	ReactDOM.createRoot(rootElement).render(<StockInfo />);
}
