import React from 'react';

interface GraphControlsProps {
  // Lap props
  lapOptions: number[];
  selectedLap: number | null;
  onLapChange: (value: number) => void;
  // Channel props (Y-Axis)
  yAxis: string;
  yAxisOptions: string[];
  onYAxisChange: (value: string) => void;
}

const GraphControls: React.FC<GraphControlsProps> = ({ 
  lapOptions,
  selectedLap,
  onLapChange,
  yAxis,
  yAxisOptions,
  onYAxisChange
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label htmlFor="lap-select" className="block text-sm font-medium text-gray-700 mb-1">
          Select Lap
        </label>
        <select
          id="lap-select"
          value={selectedLap ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              onLapChange(parseInt(value, 10));
            }
          }}
          className="block w-full bg-white border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          disabled={lapOptions.length === 0}
        >
          {lapOptions.length === 0 ? (
            <option value="">Loading laps...</option>
          ) : (
            lapOptions.map(lap => (
              <option key={lap} value={lap}>{`Lap ${lap}`}</option>
            ))
          )}
        </select>
      </div>
      
      <div>
        <label htmlFor="y-axis" className="block text-sm font-medium text-gray-700 mb-1">
          Y-Axis Data (Channel)
        </label>
        <select
          id="y-axis"
          value={yAxis}
          onChange={(e) => onYAxisChange(e.target.value)}
          className="block w-full bg-white border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          disabled={yAxisOptions.length === 0}
        >
          {yAxisOptions.length === 0 ? (
            <option value="">Loading channels...</option>
          ) : (
            yAxisOptions.map(channel => (
              <option key={channel} value={channel}>{channel}</option>
            ))
          )}
        </select>
      </div>
    </div>
  );
};

export default GraphControls;