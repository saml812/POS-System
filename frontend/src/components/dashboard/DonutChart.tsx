import { useMemo, useState } from "react";
import { formatMoney } from "../../utils/order";

export type DonutSegment = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  totalLabel: string;
  emptyLabel: string;
  hintLabel: string;
  size?: number;
};

type SliceGeometry = {
  segment: DonutSegment;
  startAngle: number;
  endAngle: number;
  path: string;
  midAngle: number;
  percentage: number;
};

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeSlice(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  if (endAngle - startAngle >= 359.99) {
    return [
      `M ${cx} ${cy - outerRadius}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${cx - 0.01} ${cy - outerRadius}`,
      `L ${cx - 0.01} ${cy - innerRadius}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius}`,
      "Z",
    ].join(" ");
  }

  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function sliceOffset(midAngle: number, distance: number) {
  const radians = ((midAngle - 90) * Math.PI) / 180;
  return {
    x: Math.cos(radians) * distance,
    y: Math.sin(radians) * distance,
  };
}

function buildSlices(
  segments: DonutSegment[],
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  total: number,
): SliceGeometry[] {
  let cursor = 0;

  return segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const sweep = (segment.value / total) * 360;
      const startAngle = cursor;
      const endAngle = cursor + sweep;
      cursor = endAngle;

      return {
        segment,
        startAngle,
        endAngle,
        midAngle: startAngle + sweep / 2,
        percentage: Math.round((segment.value / total) * 100),
        path: describeSlice(cx, cy, outerRadius, innerRadius, startAngle, endAngle),
      };
    });
}

export function DonutChart({
  segments,
  totalLabel,
  emptyLabel,
  hintLabel,
  size = 196,
}: DonutChartProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const center = size / 2;
  const outerRadius = size * 0.42;
  const innerRadius = size * 0.27;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const hasData = total > 0;

  const slices = useMemo(
    () => buildSlices(segments, center, center, outerRadius, innerRadius, total),
    [segments, center, outerRadius, innerRadius, total],
  );

  const focusId = hoverId ?? activeId;
  const focusSlice = slices.find((slice) => slice.segment.id === focusId) ?? null;
  const focusSegment =
    segments.find((segment) => segment.id === focusId) ?? null;

  function toggleSegment(id: string) {
    setActiveId((current) => (current === id ? null : id));
  }

  function segmentState(id: string) {
    if (!focusId) return "default";
    return focusId === id ? "focus" : "muted";
  }

  return (
    <div className="donut-chart">
      <div
        className="donut-chart-shell"
        onMouseLeave={() => setHoverId(null)}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="donut-chart-svg"
          role="group"
          aria-label={totalLabel}
        >
          <circle
            cx={center}
            cy={center}
            r={(outerRadius + innerRadius) / 2}
            fill="none"
            stroke="#eef0f4"
            strokeWidth={outerRadius - innerRadius}
          />

          {slices.map((slice) => {
            const state = segmentState(slice.segment.id);
            const isFocus = state === "focus";
            const offset = isFocus ? sliceOffset(slice.midAngle, 7) : { x: 0, y: 0 };

            return (
              <g
                key={slice.segment.id}
                transform={`translate(${offset.x} ${offset.y})`}
                className={`donut-slice-group donut-slice-${state}`}
              >
                <path
                  d={slice.path}
                  fill={slice.segment.color}
                  className="donut-slice"
                  tabIndex={0}
                  role="button"
                  aria-label={`${slice.segment.label}: ${formatMoney(slice.segment.value)}`}
                  aria-pressed={activeId === slice.segment.id}
                  onClick={() => toggleSegment(slice.segment.id)}
                  onMouseEnter={() => setHoverId(slice.segment.id)}
                  onFocus={() => setHoverId(slice.segment.id)}
                  onBlur={() => setHoverId(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleSegment(slice.segment.id);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>

        <div className="donut-chart-center">
          {focusSlice && focusSegment ? (
            <>
              <span
                className="donut-chart-center-badge"
                style={{ backgroundColor: focusSegment.color }}
              >
                {focusSlice.percentage}%
              </span>
              <span className="donut-chart-center-value">
                {formatMoney(focusSegment.value)}
              </span>
              <span className="donut-chart-center-sub">{focusSegment.label}</span>
            </>
          ) : (
            <>
              <span className="donut-chart-center-value">
                {hasData ? totalLabel : emptyLabel}
              </span>
              <span className="donut-chart-center-sub">
                {hasData ? hintLabel : "—"}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="donut-chart-legend">
        {segments.map((segment) => {
          const pct = hasData ? Math.round((segment.value / total) * 100) : 0;
          const state = segmentState(segment.id);

          return (
            <button
              key={segment.id}
              type="button"
              className={`donut-legend-btn donut-legend-${state}`}
              aria-pressed={activeId === segment.id}
              onClick={() => toggleSegment(segment.id)}
              onMouseEnter={() => setHoverId(segment.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <span
                className="donut-chart-swatch"
                style={{ backgroundColor: segment.color }}
                aria-hidden
              />
              <span className="donut-chart-legend-copy">
                <span className="donut-chart-legend-label">{segment.label}</span>
                <span className="donut-chart-legend-meta">
                  {formatMoney(segment.value)} · {pct}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
