import React, { useState, useRef, useEffect } from 'react';
import { DataPoint } from './mockData';

// Custom event for chart hover time
export const CHART_HOVER_EVENT = 'chart-hover-time-change';

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

interface HoverPoint {
  x: number;
  y: number;
  dataPoint: DataPoint | null;
}

// Helper function to dispatch custom hover time event
const dispatchHoverTimeEvent = (time: number | null) => {
  const event = new CustomEvent(CHART_HOVER_EVENT, { 
    detail: { time }
  });
  document.dispatchEvent(event);
};

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
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);

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

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      // Send null to indicate hover has ended when component unmounts
      dispatchHoverTimeEvent(null);
    };
  }, []);

  // Set initial hover point to first data point when data changes
  useEffect(() => {
    if (data.length > 0 && dimensions.width > 0) {
      // Calculate necessary scales for the first point
      const minX = Math.min(...data.map(d => parseFloat(d.label)));
      const maxX = Math.max(...data.map(d => parseFloat(d.label)));
      const xR = maxX - minX;
      const xS = (dimensions.width - margin.left - margin.right) / (xR === 0 ? 1 : xR);
      
      const minY = Math.min(...data.map(d => d[yAxisKey]));
      const maxY = Math.max(...data.map(d => d[yAxisKey]));
      const yR = maxY - minY;
      const yS = (dimensions.height - margin.top - margin.bottom) / (yR === 0 ? 1 : yR);
      
      const firstPoint = data[0];
      const pointX = ((parseFloat(firstPoint.label) - minX) * xS);
      const pointY = (dimensions.height - margin.top - margin.bottom) - ((firstPoint[yAxisKey] - minY) * yS);
      
      setHoverPoint({
        x: pointX,
        y: pointY,
        dataPoint: firstPoint
      });
      
      // Dispatch hover time event with the first point's time value
      console.log("Dispatching initial hover event with time:", parseFloat(firstPoint.label));
      dispatchHoverTimeEvent(parseFloat(firstPoint.label));
      
      // Force a second dispatch after a short delay to ensure it's received
      setTimeout(() => {
        console.log("Re-dispatching hover event for reliability");
        dispatchHoverTimeEvent(parseFloat(firstPoint.label));
      }, 100);
      
      // Set initial tooltip (but keep it hidden)
      setTooltip({
        visible: false,
        x: pointX + margin.left,
        y: pointY + margin.top,
        content: (
          <div>
            <div className="font-semibold">Time: {firstPoint.label}s</div>
            <div>Value: {formatValue(firstPoint[yAxisKey])}</div>
          </div>
        )
      });
    }
  }, [data, yAxisKey, dimensions]);

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
    // Format values as k (thousands), M (millions), etc.
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    } else {
      return value.toFixed(0);
    }
  };

  // Find nearest data point to mouse x-position
  const findNearestPoint = (mouseX: number) => {
    if (!data.length) return null;
    
    // Convert mouse position to data domain value
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return null;
    
    // Adjust for margin
    const adjustedMouseX = mouseX - svgRect.left - margin.left;
    
    // Bounds checking
    if (adjustedMouseX < 0 || adjustedMouseX > width) {
      return null;
    }
    
    // Convert to data value in x-domain
    const mouseDomainX = (adjustedMouseX / xScale) + minXValue;
    
    // Find nearest point
    let nearestPoint = data[0];
    let nearestDistance = Math.abs(parseFloat(nearestPoint.label) - mouseDomainX);
    
    data.forEach(point => {
      const distance = Math.abs(parseFloat(point.label) - mouseDomainX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPoint = point;
      }
    });
    
    // Calculate SVG coordinates
    const pointX = ((parseFloat(nearestPoint.label) - minXValue) * xScale);
    const pointY = height - ((nearestPoint[yAxisKey] - minYValue) * yScale);
    
    return {
      x: pointX,
      y: pointY,
      dataPoint: nearestPoint
    };
  };

  // Handle mouse movement
  const handleMouseMove = (event: React.MouseEvent) => {
    const nearest = findNearestPoint(event.clientX);
    
    if (nearest && nearest.dataPoint) {
      setHoverPoint(nearest);
      
      const value = nearest.dataPoint[yAxisKey];
      const formattedValue = formatValue(value);
      const time = nearest.dataPoint.label;
      
      // Dispatch hover time event with the current time value
      dispatchHoverTimeEvent(parseFloat(time));
      
      setTooltip({
        visible: true,
        x: nearest.x + margin.left,
        y: nearest.y + margin.top,
        content: (
          <div>
            <div className="font-semibold">Time: {time}s</div>
            <div>Value: {formattedValue}</div>
          </div>
        )
      });
    }
  };
  
  const handleMouseLeave = () => {
    // Keep the hoverPoint but hide the tooltip
    setTooltip({ ...tooltip, visible: false });
    // Don't dispatch null event, so map marker stays visible
    // dispatchHoverTimeEvent(null);
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

  // Calculate bar width for bar chart
  const calculateBarWidth = () => {
    const barCount = data.length;
    const maxBarWidth = 30; // Maximum width for a bar
    const availableWidth = width / barCount;
    return Math.min(availableWidth * 0.8, maxBarWidth); // 80% of available width, capped
  };

  // Generate X-axis ticks (whole numbers: 5, 10, 15, etc.)
  const generateXTicks = () => {
    const ticks = [];
    const tickSpacing = 5; // Use increments of 5
    
    // Calculate how many ticks we need
    const numTicks = Math.floor(xRange / tickSpacing) + 1;
    
    // Make sure we don't have too many ticks to display
    const maxTicks = 10;
    const step = numTicks > maxTicks ? Math.ceil(numTicks / maxTicks) * tickSpacing : tickSpacing;
    
    // Create tick values at intervals of 'step'
    let startTick = Math.ceil(minXValue / step) * step;
    for (let i = startTick; i <= maxXValue; i += step) {
      ticks.push(i);
    }
    
    return ticks;
  };

  // Generate Y-axis ticks (nice round numbers)
  const generateYTicks = () => {
    const ticks = [];
    
    // Find appropriate increment based on data range
    let increment;
    if (yRange > 1000000) {
      increment = 1000000; // Use 1M increments for large values
    } else if (yRange > 100000) {
      increment = 50000; // Use 50k increments
    } else if (yRange > 10000) {
      increment = 5000; // Use 5k increments
    } else if (yRange > 1000) {
      increment = 1000; // Use 1k increments
    } else if (yRange > 100) {
      increment = 50; // Use 50 increments
    } else {
      increment = 10; // Use 10 increments for small values
    }
    
    // Create tick values
    let startTick = Math.floor(minYValue / increment) * increment;
    const numTicks = Math.min(10, Math.ceil(yRange / increment) + 1); // Limit to 10 ticks
    
    for (let i = 0; i < numTicks; i++) {
      ticks.push(startTick + (i * increment));
    }
    
    return ticks;
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
          {generateYTicks().map((tickValue, index) => {
            const y = height - ((tickValue - minYValue) * yScale);
            
            // Don't render if the tick is outside the visible area
            if (y < 0 || y > height) return null;
            
            return (
              <g key={`y-tick-${index}`}>
                <line
                  x1="-5"
                  y1={y}
                  x2={width}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  strokeDasharray={tickValue === 0 ? "0" : "4"}
                />
                <text
                  x="-10"
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="12"
                  fill="#6B7280"
                >
                  {formatValue(tickValue)}
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
          {generateXTicks().map((tickValue, index) => {
            const x = ((tickValue - minXValue) * xScale);
            
            // Don't render if the tick is outside the visible area
            if (x < 0 || x > width) return null;
            
            return (
              <g key={`x-tick-${index}`}>
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
                  {tickValue}s
                </text>
              </g>
            );
          })}
          
          {/* Render chart based on chartType */}
          {chartType === 'line' ? (
            <>
              <path
                d={generateLinePath()}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3"
                strokeLinejoin="round"
                className="transition-all duration-500 ease-in-out"
              />
              
              {/* Hover point tracker */}
              {hoverPoint && (
                <circle
                  cx={hoverPoint.x}
                  cy={hoverPoint.y}
                  r="5"
                  fill="#3B82F6"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
              
              {/* Transparent overlay for mouse tracking */}
              <rect
                x="0"
                y="0"
                width={width}
                height={height}
                fill="transparent"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
            </>
          ) : (
            /* Bar chart rendering */
            <>
              {data.map((d, i) => {
                const barWidth = calculateBarWidth();
                const x = ((parseFloat(d.label) - minXValue) * xScale) - (barWidth / 2);
                const y = height - ((d[yAxisKey] - minYValue) * yScale);
                
                return (
                  <rect
                    key={`bar-${i}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height - y}
                    fill="#3B82F6"
                    onMouseMove={(e) => {
                      const nearest = {
                        x: x + barWidth / 2,
                        y: y,
                        dataPoint: d
                      };
                      setHoverPoint(nearest);
                      
                      const value = d[yAxisKey];
                      const formattedValue = formatValue(value);
                      const time = d.label;
                      
                      setTooltip({
                        visible: true,
                        x: nearest.x + margin.left,
                        y: nearest.y + margin.top,
                        content: (
                          <div>
                            <div className="font-semibold">Time: {time}s</div>
                            <div>Value: {formattedValue}</div>
                          </div>
                        )
                      });
                    }}
                    onMouseLeave={handleMouseLeave}
                    className="transition-all duration-300 ease-in-out hover:fill-blue-700"
                  />
                );
              })}
            </>
          )}
          
          
        </g>
      </svg>
      
      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="absolute bg-white px-3 py-2 rounded shadow-md text-sm z-10 pointer-events-none border border-gray-200"
          style={{
            left: tooltip.x,
            top: tooltip.y - 40, // Position above the point
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