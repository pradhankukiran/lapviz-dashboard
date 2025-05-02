import React, { useState, useRef, useEffect } from 'react';
import { DataPoint } from './mockData';

interface ChartComponentProps {
  data: DataPoint[];
  selectedLap: number | null;
  yAxisKey: 'sales' | 'revenue' | 'units';
  chartType: 'bar' | 'line';
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: React.ReactNode;
}

const ChartComponent: React.FC<ChartComponentProps> = ({ 
  data, 
  selectedLap,
  yAxisKey,
  chartType
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState<TooltipState>({ 
    visible: false, 
    x: 0, 
    y: 0, 
    content: null 
  });

  // Calculate dimensions on mount and window resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  if (!data.length || dimensions.width === 0) {
    return <div ref={containerRef} className="w-full h-full"></div>;
  }

  // Chart dimensions
  const margin = { top: 20, right: 70, bottom: 40, left: 60 };
  const width = dimensions.width - margin.left - margin.right;
  const height = dimensions.height - margin.top - margin.bottom;

  // Scale values for X and Y axes
  // For channel data: x-axis is time (s), y-axis is the data value (d)
  const minXValue = Math.min(...data.map(d => parseFloat(d.label)));
  const maxXValue = Math.max(...data.map(d => parseFloat(d.label)));
  const xRange = maxXValue - minXValue;
  const xScale = width / (xRange === 0 ? 1 : xRange); // Prevent division by zero
  
  // For data value (d) on y-axis
  const minYValue = Math.min(...data.map(d => d[yAxisKey]));
  const maxYValue = Math.max(...data.map(d => d[yAxisKey]));
  const yRange = maxYValue - minYValue;
  const yScale = height / (yRange === 0 ? 1 : yRange); // Prevent division by zero

  // Format value based on Y-axis selection
  const formatValue = (value: number) => {
    return value.toFixed(2);
  };

  // Handle tooltip display
  const showTooltip = (event: React.MouseEvent, dataPoint: DataPoint) => {
    const value = dataPoint[yAxisKey];
    const formattedValue = formatValue(value);
    const time = dataPoint.label;
    
    setTooltip({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      content: (
        <div>
          <div className="font-semibold">Time: {time}s</div>
          <div>Value: {formattedValue}</div>
        </div>
      )
    });
  };

  const hideTooltip = () => {
    setTooltip({ ...tooltip, visible: false });
  };

  // Generate line path for line chart
  const generateLinePath = () => {
    return data.map((d, i) => {
      // For channel data, x is time (s), y is the data value (d)
      const x = ((parseFloat(d.label) - minXValue) * xScale);
      const y = height - ((d[yAxisKey] - minYValue) * yScale);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Y-axis (data value) */}
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={height}
            stroke="#E5E7EB"
            strokeWidth="1"
          />
          
          {/* Y-axis ticks (data value) */}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const yValue = minYValue + (yRange * tick);
            const y = height - (yRange * tick * yScale);
            
            return (
              <g key={`y-tick-${tick}`}>
                <line
                  x1="-5"
                  y1={y}
                  x2={width}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  strokeDasharray={tick === 0 ? "0" : "4"}
                />
                <text
                  x="-10"
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="12"
                  fill="#6B7280"
                >
                  {formatValue(yValue)}
                </text>
              </g>
            );
          })}
          
          {/* X-axis (time) */}
          <line
            x1="0"
            y1={height}
            x2={width}
            y2={height}
            stroke="#E5E7EB"
            strokeWidth="1"
          />
          
          {/* X-axis ticks (time values) */}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const xValue = minXValue + (xRange * tick);
            const x = xRange * tick * xScale;
            
            return (
              <g key={`x-tick-${tick}`}>
                <line
                  x1={x}
                  y1={height}
                  x2={x}
                  y2={height + 5}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height + 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#6B7280"
                >
                  {xValue.toFixed(1)}s
                </text>
              </g>
            );
          })}
          
          {/* Render line chart (default for channel data) */}
          <path
            d={generateLinePath()}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            strokeLinejoin="round"
            className="transition-all duration-500 ease-in-out"
          />
          
          {/* Data points */}
          {data.map((d, i) => {
            const x = ((parseFloat(d.label) - minXValue) * xScale);
            const y = height - ((d[yAxisKey] - minYValue) * yScale);
            
            return (
              <circle
                key={`point-${i}`}
                cx={x}
                cy={y}
                r="3"
                fill="#3B82F6"
                stroke="#fff"
                strokeWidth="1"
                onMouseMove={(e) => showTooltip(e, d)}
                onMouseLeave={hideTooltip}
                className="transition-all duration-300 ease-in-out hover:r-4"
              />
            );
          })}
          
          {/* X-axis Label */}
          <text
            x={width / 2}
            y={height + 35}
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill="#4B5563"
          >
            Time (seconds)
          </text>
          
          {/* Y-axis Label */}
          <text
            x={-height / 2}
            y="-40"
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill="#4B5563"
            transform="rotate(-90)"
          >
            Data Value
          </text>
        </g>
      </svg>
      
      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="absolute bg-white px-3 py-2 rounded shadow-md text-sm z-10 pointer-events-none border border-gray-200"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 40,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default ChartComponent;