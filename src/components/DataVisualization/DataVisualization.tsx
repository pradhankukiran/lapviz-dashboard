import React, { useState, useEffect } from 'react';
import { BarChart, LineChart } from 'lucide-react';
import GraphControls from './GraphControls';
import ChartComponent from './ChartComponent';
import { DataPoint } from './mockData';
import LoadingSpinner from '../common/LoadingSpinner';
import { fetchLapChannelData, ChannelDataPoint } from '../../api/sessionApi';

// Define props interface
interface DataVisualizationProps {
  channels: string[];
  lapOptions: number[];
  sessionId: string;
}

const DataVisualization: React.FC<DataVisualizationProps> = ({ channels, lapOptions, sessionId }) => {
  const [selectedLap, setSelectedLap] = useState<number | null>(lapOptions.length > 0 ? lapOptions[0] : null);
  const [yAxis, setYAxis] = useState<string>(channels.length > 0 ? channels[0] : '');
  const [chartType, setChartType] = useState<'bar' | 'line'>('line');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelData, setChannelData] = useState<ChannelDataPoint[]>([]);

  useEffect(() => {
    if (lapOptions.length > 0 && selectedLap === null) {
      setSelectedLap(lapOptions[0]);
    }
    if (lapOptions.length === 0 && selectedLap !== null) {
      setSelectedLap(null);
    }
  }, [lapOptions, selectedLap]);

  useEffect(() => {
    if (channels.length > 0 && !yAxis) {
      setYAxis(channels[0]);
    }
  }, [channels, yAxis]);

  useEffect(() => {
    const fetchData = async () => {
      if (!sessionId || !selectedLap || !yAxis) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchLapChannelData(sessionId, selectedLap, yAxis);
        setChannelData(data);
      } catch (err) {
        console.error("Error fetching channel data:", err);
        setError("Failed to fetch data. Please try again.");
        setChannelData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sessionId, selectedLap, yAxis]);

  // Transform channel data for ChartComponent
  const transformedData: DataPoint[] = channelData.map((point, index) => ({
    id: index,
    timeframe: 'month', // Not used for channel data
    label: point.s.toFixed(1), // Time in seconds as label
    sales: point.d, // Use 'd' value as the y-axis value
    revenue: 0, // Not used
    units: 0, // Not used
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">Data Visualization</h2>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setChartType('bar')} 
            className={`p-2 rounded-md ${chartType === 'bar' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
            aria-label="Bar Chart"
          >
            <BarChart size={20} />
          </button>
          <button 
            onClick={() => setChartType('line')} 
            className={`p-2 rounded-md ${chartType === 'line' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
            aria-label="Line Chart"
          >
            <LineChart size={20} />
          </button>
        </div>
      </div>
      
      <GraphControls
        lapOptions={lapOptions}
        selectedLap={selectedLap}
        onLapChange={setSelectedLap}
        yAxis={yAxis}
        yAxisOptions={channels}
        onYAxisChange={setYAxis}
      />
      
      <div className="h-80 mt-6">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : channelData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            No data available for the selected parameters
          </div>
        ) : (
          <ChartComponent
            data={transformedData}
            selectedLap={selectedLap}
            yAxisKey={'sales'}
            chartType={chartType}
          />
        )}
      </div>

      {!isLoading && channelData.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          <p>Displaying {yAxis} data for Lap {selectedLap}</p>
          <p>X-axis: Time (s), Y-axis: {yAxis} value</p>
        </div>
      )}
    </div>
  );
};

export default DataVisualization;