import React, { useState, useMemo } from "react";

// ============================================================================
// BarChart Component
// ============================================================================
export function BarChart({
  data,
  labels,
  title,
  color = "#3b82f6",
  height = 200,
  horizontal = false,
  showValues = true,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const padding = { top: 10, right: 10, bottom: horizontal ? 20 : 40, left: horizontal ? 80 : 40 };
  const chartWidth = 600;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxValue = Math.max(...data, 1);

  const bars = useMemo(() => {
    if (horizontal) {
      const barHeight = (innerHeight / data.length) * 0.7;
      const gap = (innerHeight / data.length) * 0.3;
      return data.map((value, index) => ({
        x: padding.left,
        y: padding.top + index * (barHeight + gap),
        width: (value / maxValue) * innerWidth,
        height: barHeight,
        value,
        label: labels[index],
      }));
    } else {
      const barWidth = (innerWidth / data.length) * 0.7;
      const gap = (innerWidth / data.length) * 0.3;
      return data.map((value, index) => ({
        x: padding.left + index * (barWidth + gap) + gap / 2,
        y: padding.top + innerHeight - (value / maxValue) * innerHeight,
        width: barWidth,
        height: (value / maxValue) * innerHeight,
        value,
        label: labels[index],
      }));
    }
  }, [data, labels, maxValue, innerWidth, innerHeight, padding, horizontal]);

  const handleMouseEnter = (bar, index, event) => {
    setHoveredIndex(index);
    setTooltip({
      x: event.clientX,
      y: event.clientY - 40,
      value: bar.value,
      label: bar.label,
    });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTooltip(null);
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-neutral-200 text-lg font-semibold mb-4">{title}</h3>}
      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto"
          style={{ maxHeight: chartHeight }}
        >
          {/* Grid lines */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={i}
              x1={padding.left}
              y1={padding.top + (innerHeight * i) / 5}
              x2={padding.left + innerWidth}
              y2={padding.top + (innerHeight * i) / 5}
              stroke="#374151"
              strokeWidth="1"
              strokeDasharray="4"
            />
          ))}

          {/* Bars */}
          {bars.map((bar, index) => (
            <g key={index}>
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                fill={hoveredIndex === index ? adjustColor(color, 20) : color}
                rx={horizontal ? 4 : 2}
                ry={horizontal ? 4 : 2}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(bar, index, e)}
                onMouseLeave={handleMouseLeave}
              />
              {showValues && hoveredIndex === index && (
                <text
                  x={horizontal ? bar.x + bar.width + 10 : bar.x + bar.width / 2}
                  y={horizontal ? bar.y + bar.height / 2 + 4 : bar.y - 5}
                  fill="#e5e7eb"
                  fontSize="12"
                  textAnchor={horizontal ? "start" : "middle"}
                >
                  {bar.value}
                </text>
              )}
            </g>
          ))}

          {/* Labels */}
          {!horizontal &&
            labels.map((label, index) => {
              const barWidth = (innerWidth / data.length) * 0.7;
              const gap = (innerWidth / data.length) * 0.3;
              const x = padding.left + index * (barWidth + gap) + gap / 2 + barWidth / 2;
              return (
                <text
                  key={index}
                  x={x}
                  y={chartHeight - 10}
                  fill="#9ca3af"
                  fontSize="12"
                  textAnchor="middle"
                  transform={`rotate(-30, ${x}, ${chartHeight - 10})`}
                >
                  {label}
                </text>
              );
            })}

          {horizontal &&
            labels.map((label, index) => {
              const barHeight = (innerHeight / data.length) * 0.7;
              const gap = (innerHeight / data.length) * 0.3;
              const y = padding.top + index * (barHeight + gap) + barHeight / 2;
              return (
                <text
                  key={index}
                  x={padding.left - 10}
                  y={y + 4}
                  fill="#9ca3af"
                  fontSize="12"
                  textAnchor="end"
                >
                  {label}
                </text>
              );
            })}

          {/* Y-axis labels */}
          {!horizontal &&
            [0, 1, 2, 3, 4, 5].map((i) => (
              <text
                key={i}
                x={padding.left - 10}
                y={padding.top + innerHeight - (innerHeight * i) / 5 + 4}
                fill="#6b7280"
                fontSize="10"
                textAnchor="end"
              >
                {Math.round((maxValue * i) / 5)}
              </text>
            ))}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed bg-neutral-800 text-neutral-200 px-3 py-2 rounded-lg shadow-lg border border-neutral-700 pointer-events-none z-50"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="text-sm font-medium">{tooltip.label}</div>
            <div className="text-lg font-bold" style={{ color }}>
              {tooltip.value.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LineChart Component
// ============================================================================
export function LineChart({
  data,
  labels,
  title,
  color = "#3b82f6",
  height = 200,
  showArea = true,
  showPoints = true,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const padding = { top: 10, right: 20, bottom: 40, left: 50 };
  const chartWidth = 600;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data, 0);
  const valueRange = maxValue - minValue || 1;

  const points = useMemo(() => {
    return data.map((value, index) => ({
      x: padding.left + (index / (data.length - 1 || 1)) * innerWidth,
      y: padding.top + innerHeight - ((value - minValue) / valueRange) * innerHeight,
      value,
      label: labels[index],
    }));
  }, [data, labels, innerWidth, innerHeight, minValue, valueRange, padding]);

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return "";
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    return `${pathD} L ${lastPoint.x} ${padding.top + innerHeight} L ${firstPoint.x} ${
      padding.top + innerHeight
    } Z`;
  }, [points, pathD, padding, innerHeight]);

  const handleMouseEnter = (point, index, event) => {
    setHoveredIndex(index);
    setTooltip({
      x: event.clientX,
      y: event.clientY - 40,
      value: point.value,
      label: point.label,
    });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTooltip(null);
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-neutral-200 text-lg font-semibold mb-4">{title}</h3>}
      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto"
          style={{ maxHeight: chartHeight }}
        >
          {/* Grid lines */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={i}
              x1={padding.left}
              y1={padding.top + (innerHeight * i) / 5}
              x2={padding.left + innerWidth}
              y2={padding.top + (innerHeight * i) / 5}
              stroke="#374151"
              strokeWidth="1"
              strokeDasharray="4"
            />
          ))}

          {/* Area fill */}
          {showArea && (
            <path
              d={areaD}
              fill={color}
              fillOpacity="0.15"
              className="transition-all duration-300"
            />
          )}

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />

          {/* Points */}
          {showPoints &&
            points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={hoveredIndex === index ? 6 : 4}
                fill={color}
                stroke="#1f2937"
                strokeWidth="2"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(point, index, e)}
                onMouseLeave={handleMouseLeave}
              />
            ))}

          {/* X-axis labels */}
          {labels.map((label, index) => {
            const x = padding.left + (index / (data.length - 1 || 1)) * innerWidth;
            const showLabel = data.length <= 12 || index % Math.ceil(data.length / 12) === 0;
            return (
              showLabel && (
                <text
                  key={index}
                  x={x}
                  y={chartHeight - 10}
                  fill="#9ca3af"
                  fontSize="12"
                  textAnchor="middle"
                >
                  {label}
                </text>
              )
            );
          })}

          {/* Y-axis labels */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <text
              key={i}
              x={padding.left - 10}
              y={padding.top + innerHeight - (innerHeight * i) / 5 + 4}
              fill="#6b7280"
              fontSize="10"
              textAnchor="end"
            >
              {Math.round(minValue + (valueRange * i) / 5)}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed bg-neutral-800 text-neutral-200 px-3 py-2 rounded-lg shadow-lg border border-neutral-700 pointer-events-none z-50"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="text-sm font-medium">{tooltip.label}</div>
            <div className="text-lg font-bold" style={{ color }}>
              {tooltip.value.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PieChart Component
// ============================================================================
export function PieChart({
  data,
  labels,
  title,
  colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"],
  height = 200,
  donut = true,
  showLegend = true,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const chartWidth = 300;
  const chartHeight = height;
  const centerX = chartWidth / 2;
  const centerY = chartHeight / 2;
  const radius = Math.min(centerX, centerY) - 20;
  const innerRadius = donut ? radius * 0.5 : 0;

  const total = data.reduce((sum, value) => sum + value, 0) || 1;

  const segments = useMemo(() => {
    let currentAngle = -Math.PI / 2;
    return data.map((value, index) => {
      const angle = (value / total) * Math.PI * 2;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const largeArcFlag = angle > Math.PI ? 1 : 0;

      const startX = centerX + Math.cos(startAngle) * radius;
      const startY = centerY + Math.sin(startAngle) * radius;
      const endX = centerX + Math.cos(endAngle) * radius;
      const endY = centerY + Math.sin(endAngle) * radius;

      const innerStartX = centerX + Math.cos(startAngle) * innerRadius;
      const innerStartY = centerY + Math.sin(startAngle) * innerRadius;
      const innerEndX = centerX + Math.cos(endAngle) * innerRadius;
      const innerEndY = centerY + Math.sin(endAngle) * innerRadius;

      const pathD = donut
        ? `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY} Z`
        : `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

      return {
        pathD,
        value,
        label: labels[index],
        color: colors[index % colors.length],
        percentage: ((value / total) * 100).toFixed(1),
        startAngle,
        endAngle,
      };
    });
  }, [data, labels, colors, total, centerX, centerY, radius, innerRadius, donut]);

  const handleMouseEnter = (segment, index, event) => {
    setHoveredIndex(index);
    setTooltip({
      x: event.clientX,
      y: event.clientY - 40,
      ...segment,
    });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTooltip(null);
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-neutral-200 text-lg font-semibold mb-4">{title}</h3>}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto"
            style={{ maxWidth: chartWidth, maxHeight: chartHeight }}
          >
            {segments.map((segment, index) => (
              <path
                key={index}
                d={segment.pathD}
                fill={segment.color}
                stroke="#1f2937"
                strokeWidth="2"
                className="transition-all duration-200 cursor-pointer"
                style={{
                  transform:
                    hoveredIndex === index
                      ? `translate(${Math.cos((segment.startAngle + segment.endAngle) / 2) * 8}px, ${
                          Math.sin((segment.startAngle + segment.endAngle) / 2) * 8
                        }px)`
                      : "translate(0, 0)",
                  opacity: hoveredIndex !== null && hoveredIndex !== index ? 0.6 : 1,
                }}
                onMouseEnter={(e) => handleMouseEnter(segment, index, e)}
                onMouseLeave={handleMouseLeave}
              />
            ))}

            {/* Center text for donut chart */}
            {donut && (
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#e5e7eb"
                fontSize="14"
                fontWeight="600"
              >
                {total.toLocaleString()}
              </text>
            )}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="fixed bg-neutral-800 text-neutral-200 px-3 py-2 rounded-lg shadow-lg border border-neutral-700 pointer-events-none z-50"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <div className="text-sm font-medium">{tooltip.label}</div>
              <div className="text-lg font-bold" style={{ color: tooltip.color }}>
                {tooltip.value.toLocaleString()} ({tooltip.percentage}%)
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex flex-wrap sm:flex-col gap-2 sm:gap-1">
            {segments.map((segment, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(segment, index, e)}
                onMouseLeave={handleMouseLeave}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-neutral-400 text-sm">{segment.label}</span>
                <span className="text-neutral-200 text-sm font-medium">
                  {segment.percentage}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// StatsCard Component
// ============================================================================
export function StatsCard({ title, value, subtitle, trend, trendUp, icon, onClick }) {
  const trendColor = trendUp ? "text-emerald-400" : "text-red-400";
  const TrendIcon = trendUp ? ArrowUpIcon : ArrowDownIcon;

  return (
    <div
      onClick={onClick}
      className={`bg-neutral-800 rounded-xl p-5 border border-neutral-700 ${
        onClick ? "cursor-pointer hover:border-neutral-600" : ""
      } transition-all duration-200 hover:shadow-lg`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-neutral-400 text-sm font-medium mb-1">{title}</p>
          <h4 className="text-neutral-100 text-2xl font-bold mb-1">
            {typeof value === "number" ? value.toLocaleString() : value}
          </h4>
          {subtitle && <p className="text-neutral-500 text-xs">{subtitle}</p>}

          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
              <span className={`text-sm font-medium ${trendColor}`}>
                {trend > 0 ? "+" : ""}
                {trend}%
              </span>
              <span className="text-neutral-500 text-xs ml-1">vs last period</span>
            </div>
          )}
        </div>

        {icon && (
          <div className="w-12 h-12 rounded-xl bg-neutral-700 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Heatmap Component
// ============================================================================
export function Heatmap({ data, xLabels, yLabels, title, colorScheme = "blue" }) {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const cellWidth = 40;
  const cellHeight = 30;
  const padding = { top: 10, right: 10, bottom: 40, left: 80 };
  const chartWidth = padding.left + xLabels.length * cellWidth + padding.right;
  const chartHeight = padding.top + yLabels.length * cellHeight + padding.bottom;

  const allValues = data.flat();
  const maxValue = Math.max(...allValues, 1);
  const minValue = Math.min(...allValues, 0);
  const valueRange = maxValue - minValue || 1;

  const getColor = (value) => {
    const intensity = (value - minValue) / valueRange;
    const schemes = {
      blue: `rgba(59, 130, 246, ${0.1 + intensity * 0.9})`,
      green: `rgba(16, 185, 129, ${0.1 + intensity * 0.9})`,
      red: `rgba(239, 68, 68, ${0.1 + intensity * 0.9})`,
      purple: `rgba(139, 92, 246, ${0.1 + intensity * 0.9})`,
    };
    return schemes[colorScheme] || schemes.blue;
  };

  const getTextColor = (value) => {
    const intensity = (value - minValue) / valueRange;
    return intensity > 0.5 ? "#ffffff" : "#9ca3af";
  };

  const handleMouseEnter = (value, xLabel, yLabel, x, y, event) => {
    setHoveredCell({ x, y });
    setTooltip({
      x: event.clientX,
      y: event.clientY - 40,
      value,
      xLabel,
      yLabel,
    });
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
    setTooltip(null);
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-neutral-200 text-lg font-semibold mb-4">{title}</h3>}
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto"
          style={{ minWidth: chartWidth }}
        >
          {/* Cells */}
          {data.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              const x = padding.left + colIndex * cellWidth;
              const y = padding.top + rowIndex * cellHeight;
              return (
                <rect
                  key={`${rowIndex}-${colIndex}`}
                  x={x}
                  y={y}
                  width={cellWidth}
                  height={cellHeight}
                  fill={getColor(value)}
                  stroke="#374151"
                  strokeWidth="1"
                  className="transition-all duration-200 cursor-pointer"
                  style={{
                    opacity:
                      hoveredCell &&
                      (hoveredCell.x !== colIndex || hoveredCell.y !== rowIndex)
                        ? 0.7
                        : 1,
                  }}
                  onMouseEnter={(e) =>
                    handleMouseEnter(value, xLabels[colIndex], yLabels[rowIndex], colIndex, rowIndex, e)
                  }
                  onMouseLeave={handleMouseLeave}
                />
              );
            })
          )}

          {/* Values in cells */}
          {data.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              const x = padding.left + colIndex * cellWidth + cellWidth / 2;
              const y = padding.top + rowIndex * cellHeight + cellHeight / 2 + 4;
              return (
                <text
                  key={`text-${rowIndex}-${colIndex}`}
                  x={x}
                  y={y}
                  fill={getTextColor(value)}
                  fontSize="10"
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {value}
                </text>
              );
            })
          )}

          {/* X-axis labels */}
          {xLabels.map((label, index) => (
            <text
              key={`x-${index}`}
              x={padding.left + index * cellWidth + cellWidth / 2}
              y={chartHeight - 10}
              fill="#9ca3af"
              fontSize="11"
              textAnchor="middle"
            >
              {label}
            </text>
          ))}

          {/* Y-axis labels */}
          {yLabels.map((label, index) => (
            <text
              key={`y-${index}`}
              x={padding.left - 10}
              y={padding.top + index * cellHeight + cellHeight / 2 + 4}
              fill="#9ca3af"
              fontSize="11"
              textAnchor="end"
            >
              {label}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed bg-neutral-800 text-neutral-200 px-3 py-2 rounded-lg shadow-lg border border-neutral-700 pointer-events-none z-50"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="text-sm text-neutral-400">
              {tooltip.yLabel} - {tooltip.xLabel}
            </div>
            <div className="text-lg font-bold">{tooltip.value.toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DataTable Component
// ============================================================================
export function DataTable({
  columns,
  data,
  sortable = false,
  onSort,
  pagination,
  rowKey = "id",
  onRowClick,
  emptyMessage = "No data available",
}) {
  const [sortConfig, setSortConfig] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (key) => {
    if (!sortable) return;

    let direction = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }

    setSortConfig({ key, direction });
    onSort?.(key, direction);
  };

  const sortedData = useMemo(() => {
    if (!sortConfig || onSort) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig, onSort]);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * pagination.pageSize;
    return sortedData.slice(start, start + pagination.pageSize);
  }, [sortedData, pagination, currentPage]);

  const totalPages = pagination ? Math.ceil(data.length / pagination.pageSize) : 1;

  const formatValue = (value, format) => {
    if (format === "currency") {
      return `฿${Number(value).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;
    }
    if (format === "number") {
      return Number(value).toLocaleString();
    }
    if (format === "date") {
      return new Date(value).toLocaleDateString("th-TH");
    }
    if (format === "datetime") {
      return new Date(value).toLocaleString("th-TH");
    }
    if (format === "percent") {
      return `${value}%`;
    }
    return value;
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-700">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`text-left py-3 px-4 text-sm font-semibold text-neutral-400 ${
                    sortable ? "cursor-pointer hover:text-neutral-200" : ""
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortable && (
                      <SortIcon
                        className={`w-4 h-4 ${
                          sortConfig?.key === col.key ? "text-blue-400" : "text-neutral-600"
                        }`}
                        direction={sortConfig?.key === col.key ? sortConfig.direction : null}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-neutral-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={row[rowKey] || index}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-neutral-800 ${
                    onRowClick ? "cursor-pointer hover:bg-neutral-800" : ""
                  } transition-colors`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="py-3 px-4 text-sm text-neutral-200">
                      {col.render
                        ? col.render(row[col.key], row)
                        : formatValue(row[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
          <div className="text-sm text-neutral-500">
            Showing {(currentPage - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(currentPage * pagination.pageSize, data.length)} of {data.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg bg-neutral-800 text-neutral-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-700 transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? "bg-blue-500 text-white"
                      : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-lg bg-neutral-800 text-neutral-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ExportButton Component
// ============================================================================
export function ExportButton({ onExport, label = "Export CSV", loading = false, disabled = false }) {
  return (
    <button
      onClick={onExport}
      disabled={loading || disabled}
      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
    >
      {loading ? (
        <>
          <LoadingSpinner className="w-4 h-4" />
          <span>Exporting...</span>
        </>
      ) : (
        <>
          <DownloadIcon className="w-4 h-4" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

// ============================================================================
// DateRangePicker Component
// ============================================================================
export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onApply,
  presets = [
    { label: "Today", days: 0 },
    { label: "Yesterday", days: 1 },
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "This month", days: -1 },
  ],
}) {
  const [showPresets, setShowPresets] = useState(false);

  const handlePreset = (preset) => {
    const end = new Date();
    let start;

    if (preset.days === -1) {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if (preset.days === 0) {
      start = new Date(end);
    } else {
      start = new Date(end);
      start.setDate(start.getDate() - preset.days);
    }

    onStartChange(start.toISOString().split("T")[0]);
    onEndChange(end.toISOString().split("T")[0]);
    setShowPresets(false);
  };

  const formatDateForInput = (date) => {
    if (!date) return "";
    return typeof date === "string" ? date : date.toISOString().split("T")[0];
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-sm transition-colors"
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Presets</span>
          <ChevronDownIcon className={`w-4 h-4 transition-transform ${showPresets ? "rotate-180" : ""}`} />
        </button>

        {showPresets && (
          <div className="absolute top-full left-0 mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-50 min-w-[140px]">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset)}
                className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 first:rounded-t-lg last:rounded-b-lg transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={formatDateForInput(startDate)}
          onChange={(e) => onStartChange(e.target.value)}
          className="px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
        <span className="text-neutral-500">to</span>
        <input
          type="date"
          value={formatDateForInput(endDate)}
          onChange={(e) => onEndChange(e.target.value)}
          className="px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {onApply && (
        <button
          onClick={onApply}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Apply
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Icon Components
// ============================================================================
function ArrowUpIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  );
}

function ArrowDownIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  );
}

function DownloadIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function CalendarIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function LoadingSpinner({ className }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function SortIcon({ className, direction }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {direction === "asc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      ) : direction === "desc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15l-4 4-4-4" />
        </>
      )}
    </svg>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================
function adjustColor(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
