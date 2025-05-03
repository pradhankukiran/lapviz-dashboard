import React, { useState, useEffect, useCallback } from 'react';
import { LineChart } from 'lucide-react';
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
  selectedLap?: number | null;
  onLapChange?: (lap: number | null) => void;
}

const DataVisualization: React.FC<DataVisualizationProps> = ({ 
  channels, 
  lapOptions, 
  sessionId,
  selectedLap: propSelectedLap,
  onLapChange
}) => {
  // Use internal state if no external control is provided
  const [internalSelectedLap, setInternalSelectedLap] = useState<number | null>(
    lapOptions.length > 0 ? lapOptions[0] : null
  );
  
  // Determine if we're using controlled or uncontrolled mode
  const isControlled = propSelectedLap !== undefined && onLapChange !== undefined;
  const selectedLap = isControlled ? propSelectedLap : internalSelectedLap;
  
  // Handler for lap changes
  const handleLapChange = useCallback((lap: number) => {
    if (isControlled && onLapChange) {
      onLapChange(lap);
    } else {
      setInternalSelectedLap(lap);
    }
  }, [isControlled, onLapChange]);

  // Special handler to set lap to null
  const clearSelectedLap = useCallback(() => {
    if (isControlled && onLapChange) {
      onLapChange(null);
    } else {
      setInternalSelectedLap(null);
    }
  }, [isControlled, onLapChange]);

  const [yAxis, setYAxis] = useState<string>(channels.length > 0 ? channels[0] : '');
  const chartType = 'line';
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelData, setChannelData] = useState<ChannelDataPoint[]>([]);

  useEffect(() => {
    if (lapOptions.length > 0 && selectedLap === null && !isControlled) {
      // Set the first lap option when we have options but no selection
      if (lapOptions[0]) {
        handleLapChange(lapOptions[0]);
      }
    }
  }, [lapOptions, selectedLap, isControlled, handleLapChange]);

  useEffect(() => {
    if (lapOptions.length === 0 && selectedLap !== null && !isControlled) {
      // Clear selected lap when there are no options
      clearSelectedLap();
    }
  }, [lapOptions, selectedLap, isControlled, clearSelectedLap]);

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
      
      
      
      <GraphControls
        lapOptions={lapOptions}
        selectedLap={selectedLap}
        onLapChange={handleLapChange}
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

     
    </div>
  );
};

export default DataVisualization;