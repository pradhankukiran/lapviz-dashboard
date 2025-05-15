import React, { useState, useRef, useEffect } from 'react';
import { DataPoint } from './mockData';
import { useSyncContext } from '../../contexts/SyncContext'; // Import SyncContext

// Custom event for chart hover time
export const CHART_HOVER_EVENT = 'chart-hover-time-change';

// Define margin outside the component for stability
const margin = { top: 20, right: 70, bottom: 40, left: 60 };

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
  const { graphTime, isSyncActive } = useSyncContext(); // Consume context
  const lastDispatchedGraphTimeRef = useRef<number | null>(null); // For event dispatching

  // Chart dimensions (memoized or stable) - margin is now defined outside
  // const margin = { top: 20, right: 70, bottom: 40, left: 60 };

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
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Effect for video-driven synchronization
  useEffect(() => {
    if (isSyncActive && graphTime !== null && data.length > 0 && dimensions.width > 0 && dimensions.height > 0) {
      const chartWidth = dimensions.width - margin.left - margin.right;
      const chartHeight = dimensions.height - margin.top - margin.bottom;

      const minX = Math.min(...data.map(d => parseFloat(d.label)));
      const maxX = Math.max(...data.map(d => parseFloat(d.label)));
      const xRange = maxX - minX;
      const xScale = chartWidth / (xRange === 0 ? 1 : xRange);

      const minY = Math.min(...data.map(d => d[yAxisKey]));
      const maxY = Math.max(...data.map(d => d[yAxisKey]));
      const yRange = maxY - minY;
      const yScale = chartHeight / (yRange === 0 ? 1 : yRange);

      // Find the data point whose time (label) is closest to graphTime
      let nearestDataPoint = data[0];
      let smallestDiff = Math.abs(parseFloat(data[0].label) - graphTime);
      for (let i = 1; i < data.length; i++) {
        const diff = Math.abs(parseFloat(data[i].label) - graphTime);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          nearestDataPoint = data[i];
        }
      }

      // Calculate X position based on graphTime, clamped to chart bounds
      const currentGraphTimeX = Math.max(minX, Math.min(maxX, graphTime));
      const svgX = ((currentGraphTimeX - minX) * xScale);
      // Y position based on the Y value of the *nearest actual data point*
      const svgY = chartHeight - ((nearestDataPoint[yAxisKey] - minY) * yScale);

      setHoverPoint({
        x: svgX,
        y: svgY,
        dataPoint: nearestDataPoint, // For tooltip content consistency
      });

      setTooltip({
        visible: true, // Tooltip should be visible during sync
        x: svgX + margin.left,
        y: svgY + margin.top,
        content: (
          <div>
            <div className="font-semibold">Time: {graphTime.toFixed(1)}s (Sync)</div>
            <div>{yAxisKey}: {formatValue(nearestDataPoint[yAxisKey])} (at {nearestDataPoint.label}s)</div>
          </div>
        ),
      });

      // Dispatch event for map, only if time changed significantly
      if (lastDispatchedGraphTimeRef.current === null || Math.abs(lastDispatchedGraphTimeRef.current - graphTime) > 0.05) {
        dispatchHoverTimeEvent(graphTime);
        lastDispatchedGraphTimeRef.current = graphTime;
      }
    } else if (!isSyncActive) {
        // If sync is not active, hide the sync-driven tooltip.
        // Mouse hover will manage its own tooltip visibility.
        setTooltip(prev => ({...prev, visible: false}));
        // Potentially reset hoverPoint to what mouse would dictate or first point if mouse is off chart
    }
  }, [isSyncActive, graphTime, data, dimensions, yAxisKey, margin]);

  // Set initial hover point or when data changes (only if not in sync mode)
  useEffect(() => {
    if (!isSyncActive && data.length > 0 && dimensions.width > 0 && dimensions.height > 0) {
      const chartWidth = dimensions.width - margin.left - margin.right;
      const chartHeight = dimensions.height - margin.top - margin.bottom;

      const minX = Math.min(...data.map(d => parseFloat(d.label)));
      const maxX = Math.max(...data.map(d => parseFloat(d.label)));
      const xRange = maxX - minX;
      const xScale = chartWidth / (xRange === 0 ? 1 : xRange);

      const minY = Math.min(...data.map(d => d[yAxisKey]));
      const maxY = Math.max(...data.map(d => d[yAxisKey]));
      const yRange = maxY - minY;
      const yScale = chartHeight / (yRange === 0 ? 1 : yRange);
      
      const firstPoint = data[0];
      const pointX = ((parseFloat(firstPoint.label) - minX) * xScale);
      const pointY = chartHeight - ((firstPoint[yAxisKey] - minY) * yScale);
      
      setHoverPoint({
        x: pointX,
        y: pointY,
        dataPoint: firstPoint
      });
      
      const firstPointTime = parseFloat(firstPoint.label);
      // Dispatch only if time actually changes from what might have been dispatched by sync
      if (lastDispatchedGraphTimeRef.current === null || Math.abs(lastDispatchedGraphTimeRef.current - firstPointTime) > 0.05) {
          dispatchHoverTimeEvent(firstPointTime);
          lastDispatchedGraphTimeRef.current = firstPointTime;
      }
      // Tooltip for initial point is typically hidden until mouse interaction
      setTooltip({ visible: false, x: 0, y: 0, content: null }); 

    } else if (!isSyncActive && data.length === 0) {
        setHoverPoint(null);
        if (lastDispatchedGraphTimeRef.current !== null) {
            dispatchHoverTimeEvent(null);
            lastDispatchedGraphTimeRef.current = null;
        }
    }
  }, [data, yAxisKey, dimensions, isSyncActive, margin]); // Add margin here

  useEffect(() => {
    return () => {
      if (lastDispatchedGraphTimeRef.current !== null) {
        dispatchHoverTimeEvent(null); // Dispatch null on unmount
        lastDispatchedGraphTimeRef.current = null;
      }
    };
  }, []);

  if (!data.length || dimensions.width === 0 || dimensions.height === 0 ) {
    return <div ref={containerRef} className="w-full h-full">Loading or no data...</div>;
  }

  // Stable chart dimensions for rendering logic
  const width = dimensions.width - margin.left - margin.right;
  const height = dimensions.height - margin.top - margin.bottom;

  const minXValue = Math.min(...data.map(d => parseFloat(d.label)));
  const maxXValue = Math.max(...data.map(d => parseFloat(d.label)));
  const xRange = maxXValue - minXValue;
  const xScale = width / (xRange === 0 ? 1 : xRange);
  
  const minYValue = Math.min(...data.map(d => d[yAxisKey]));
  const maxYValue = Math.max(...data.map(d => d[yAxisKey]));
  const yRange = maxYValue - minYValue;
  const yScale = height / (yRange === 0 ? 1 : yRange);

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toFixed(0);
  };

  const findNearestPointForMouseEvent = (mouseXClient: number) => {
    if (!data.length || !svgRef.current) return null;
    
    const svgRect = svgRef.current.getBoundingClientRect();
    const svgMouseX = mouseXClient - svgRect.left - margin.left;
    
    if (svgMouseX < 0 || svgMouseX > width) {
      return null; 
    }
    
    const mouseDomainX = (svgMouseX / xScale) + minXValue;
    
    let nearestPoint = data[0];
    let nearestDistance = Math.abs(parseFloat(nearestPoint.label) - mouseDomainX);
    
    data.forEach(point => {
      const distance = Math.abs(parseFloat(point.label) - mouseDomainX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPoint = point;
      }
    });
    
    const pointX = ((parseFloat(nearestPoint.label) - minXValue) * xScale);
    const pointY = height - ((nearestPoint[yAxisKey] - minYValue) * yScale);
    
    return {
      x: pointX,
      y: pointY,
      dataPoint: nearestPoint
    };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (isSyncActive) return; // Ignore mouse if sync is active

    const nearest = findNearestPointForMouseEvent(event.clientX);
    
    if (nearest && nearest.dataPoint) {
      setHoverPoint(nearest);
      
      const value = nearest.dataPoint[yAxisKey];
      const formattedValue = formatValue(value);
      const time = nearest.dataPoint.label;
      
      const currentTime = parseFloat(time);
      if (lastDispatchedGraphTimeRef.current === null || Math.abs(lastDispatchedGraphTimeRef.current - currentTime) > 0.05) {
        dispatchHoverTimeEvent(currentTime);
        lastDispatchedGraphTimeRef.current = currentTime;
      }
      
      setTooltip({
        visible: true,
        x: nearest.x + margin.left,
        y: nearest.y + margin.top,
        content: (
          <div>
            <div className="font-semibold">Time: {time}s</div>
            <div>{yAxisKey}: {formattedValue}</div>
          </div>
        )
      });
    } else {
        // If mouse moves off chart but still within SVG area (e.g. margins)
        setTooltip(prev => ({...prev, visible: false}));
    }
  };
  
  const handleMouseLeave = () => {
    if (isSyncActive) return; // Ignore mouse if sync is active
    setTooltip(prev => ({...prev, visible: false}));
    // Don't dispatch null here to keep map marker at last position when mouse leaves chart
    // If you want map marker to disappear: 
    // if(lastDispatchedGraphTimeRef.current !== null) { dispatchHoverTimeEvent(null); lastDispatchedGraphTimeRef.current = null; }
  };

  const generateLinePath = () => {
    return data.map((d, i) => {
      const x = ((parseFloat(d.label) - minXValue) * xScale);
      const y = height - ((d[yAxisKey] - minYValue) * yScale);
      return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
    }).join(' ');
  };

  const calculateBarWidth = () => {
    const barCount = data.length;
    const maxBarWidth = 30;
    const availableWidth = width / barCount;
    return Math.min(availableWidth * 0.8, maxBarWidth);
  };

  const generateXTicks = () => {
    const ticks = [];
    if (xRange === undefined || isNaN(xRange)) return [];
    const tickSpacing = xRange > 50 ? 10 : (xRange > 10 ? 5 : 1);
    const numTicks = Math.floor(xRange / tickSpacing) + 1;
    const maxTicks = Math.floor(width / 50); // Max 1 tick per 50px
    const step = numTicks > maxTicks ? Math.ceil(numTicks / maxTicks) * tickSpacing : tickSpacing;
    let startTick = Math.ceil(minXValue / step) * step;
    for (let i = startTick; i <= maxXValue + step / 2; i += step) { // Add step/2 for boundary cases
        if (i >= minXValue && i <= maxXValue) ticks.push(i);
    }
    return ticks;
  };

  const generateYTicks = () => {
    const ticks = [];
    if (yRange === undefined || isNaN(yRange)) return [];
    const numTicksGoal = Math.max(2, Math.floor(height / 40)); // Aim for 1 tick per 40px, min 2
    let increment = yRange / numTicksGoal;
    // Make increment a nice round number
    const pow10 = Math.pow(10, Math.floor(Math.log10(increment)));
    increment = Math.ceil(increment / pow10) * pow10;
    if (increment === 0 && yRange > 0) increment = yRange / 2 || 1; // Handle very small ranges or single point
    else if (increment === 0 && yRange === 0) increment = 1; // Avoid infinite loop if range is 0

    let currentTick = Math.floor(minYValue / increment) * increment;
    if (currentTick < minYValue) currentTick += increment;

    for (let i = 0; i < numTicksGoal * 2 && currentTick <= maxYValue + increment / 2 ; i++) {
        if(currentTick >= minYValue - increment /2 ) ticks.push(currentTick);
        currentTick += increment;
        if (ticks.length > numTicksGoal + 2) break; // Safety break
    }
    if (ticks.length === 0 && data.length > 0) ticks.push(minYValue); // Ensure at least one tick if data exists
    return [...new Set(ticks)]; // Remove duplicates
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove} // Attach to SVG for better area coverage
        onMouseLeave={handleMouseLeave}
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <line x1="0" y1="0" x2="0" y2={height} stroke="#E5E7EB" strokeWidth="1" />
          {generateYTicks().map((tickValue, index) => {
            const y = height - ((tickValue - minYValue) * yScale);
            if (y < -5 || y > height + 5 || isNaN(y)) return null; // Generous bounds for ticks
            return (
              <g key={`y-tick-${index}`}>
                <line x1="-5" y1={y} x2={width} y2={y} stroke="#E5E7EB" strokeWidth="1" strokeDasharray={tickValue === 0 ? "0" : "4"} />
                <text x="-10" y={y} textAnchor="end" dominantBaseline="middle" fontSize="12" fill="#6B7280">
                  {formatValue(tickValue)}
                </text>
              </g>
            );
          })}
          
          <line x1="0" y1={height} x2={width} y2={height} stroke="#E5E7EB" strokeWidth="1" />
          {generateXTicks().map((tickValue, index) => {
            const x = ((tickValue - minXValue) * xScale);
            if (x < -5 || x > width + 5 || isNaN(x)) return null;
            return (
              <g key={`x-tick-${index}`}>
                <line x1={x} y1={height} x2={x} y2={height + 5} stroke="#E5E7EB" strokeWidth="1" />
                <text x={x} y={height + 20} textAnchor="middle" fontSize="12" fill="#6B7280">
                  {tickValue}s
                </text>
              </g>
            );
          })}
          
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
              {/* Removed transparent overlay for mouse tracking as events are on SVG directly */}
            </>
          ) : (
            <>
              {data.map((d, i) => {
                const barWidth = calculateBarWidth();
                const x = ((parseFloat(d.label) - minXValue) * xScale) - (barWidth / 2);
                const y = height - ((d[yAxisKey] - minYValue) * yScale);
                // Bar interactions are disabled when sync is active to prevent conflicts
                return (
                  <rect
                    key={`bar-${i}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(0, height - y)} // Ensure height is not negative
                    fill="#3B82F6"
                    onMouseMove={isSyncActive ? undefined : (e) => {
                      const barHoverX = x + barWidth / 2;
                      const barHoverY = y;
                      const nearest = { x: barHoverX, y: barHoverY, dataPoint: d };
                      setHoverPoint(nearest);
                      const value = d[yAxisKey];
                      const formattedValue = formatValue(value);
                      const time = d.label;
                      const currentTime = parseFloat(time);
                      if (lastDispatchedGraphTimeRef.current === null || Math.abs(lastDispatchedGraphTimeRef.current - currentTime) > 0.05) {
                        dispatchHoverTimeEvent(currentTime);
                        lastDispatchedGraphTimeRef.current = currentTime;
                      }
                      setTooltip({
                        visible: true,
                        x: barHoverX + margin.left,
                        y: barHoverY + margin.top,
                        content: (<div><div className="font-semibold">Time: {time}s</div><div>{yAxisKey}: {formattedValue}</div></div>)
                      });
                    }}
                    onMouseLeave={isSyncActive ? undefined : handleMouseLeave}
                    className={`transition-all duration-300 ease-in-out ${!isSyncActive ? 'hover:fill-blue-700' : ''}`}
                  />
                );
              })}
            </>
          )}
        </g>
      </svg>
      
      {tooltip.visible && (
        <div
          className="absolute bg-white px-3 py-2 rounded shadow-md text-sm z-10 pointer-events-none border border-gray-200"
          style={{
            left: tooltip.x,
            top: tooltip.y - 10, // Position above the point
            transform: 'translateX(-50%) translateY(-100%)', // Better positioning
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default ChartComponent;