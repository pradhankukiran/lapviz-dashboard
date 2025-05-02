export interface DataPoint {
  id: number;
  timeframe: 'month' | 'quarter' | 'year';
  label: string;
  sales: number;
  revenue: number;
  units: number;
}

// Generate mock data for all timeframes
export const mockData: DataPoint[] = [
  // Monthly data
  { id: 1, timeframe: 'month', label: 'Jan', sales: 65, revenue: 65000, units: 1200 },
  { id: 2, timeframe: 'month', label: 'Feb', sales: 59, revenue: 59000, units: 1100 },
  { id: 3, timeframe: 'month', label: 'Mar', sales: 80, revenue: 80000, units: 1500 },
  { id: 4, timeframe: 'month', label: 'Apr', sales: 81, revenue: 81000, units: 1550 },
  { id: 5, timeframe: 'month', label: 'May', sales: 56, revenue: 56000, units: 1000 },
  { id: 6, timeframe: 'month', label: 'Jun', sales: 55, revenue: 55000, units: 980 },
  { id: 7, timeframe: 'month', label: 'Jul', sales: 40, revenue: 40000, units: 800 },
  { id: 8, timeframe: 'month', label: 'Aug', sales: 70, revenue: 70000, units: 1300 },
  { id: 9, timeframe: 'month', label: 'Sep', sales: 90, revenue: 90000, units: 1700 },
  { id: 10, timeframe: 'month', label: 'Oct', sales: 95, revenue: 95000, units: 1800 },
  { id: 11, timeframe: 'month', label: 'Nov', sales: 85, revenue: 85000, units: 1600 },
  { id: 12, timeframe: 'month', label: 'Dec', sales: 100, revenue: 100000, units: 2000 },
  
  // Quarterly data
  { id: 13, timeframe: 'quarter', label: 'Q1', sales: 204, revenue: 204000, units: 3800 },
  { id: 14, timeframe: 'quarter', label: 'Q2', sales: 192, revenue: 192000, units: 3530 },
  { id: 15, timeframe: 'quarter', label: 'Q3', sales: 200, revenue: 200000, units: 3800 },
  { id: 16, timeframe: 'quarter', label: 'Q4', sales: 280, revenue: 280000, units: 5400 },
  
  // Yearly data
  { id: 17, timeframe: 'year', label: '2021', sales: 760, revenue: 760000, units: 14000 },
  { id: 18, timeframe: 'year', label: '2022', sales: 825, revenue: 825000, units: 15500 },
  { id: 19, timeframe: 'year', label: '2023', sales: 876, revenue: 876000, units: 16530 },
  { id: 20, timeframe: 'year', label: '2024', sales: 920, revenue: 920000, units: 17800 },
];