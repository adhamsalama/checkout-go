import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";
import { formatMoney, formatMoneyShort } from "../format";
import { chartColors } from "./chartTheme";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

/** A single-series bar chart of amounts. Tapping a bar selects it; the others fade. */
export default function BarChart({
  labels,
  titles,
  data,
  selected,
  onSelect,
  height,
}: {
  labels: string[];
  /** Tooltip title per bar; defaults to the label. */
  titles?: string[];
  data: number[];
  selected?: number | null;
  onSelect?: (index: number) => void;
  height?: number;
}) {
  const { text, grid, series } = chartColors();
  const color = series[0];
  return (
    <div className="chart-box" style={height ? { height } : undefined}>
      <Bar
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          onClick: onSelect
            ? (e, _, chart) => {
                const i = Math.round(chart.scales.x.getValueForPixel(e.x ?? 0) ?? -1);
                if (i >= 0 && i < labels.length) onSelect(i);
              }
            : undefined,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => (titles ?? labels)[items[0]?.dataIndex ?? 0],
                label: (c) => formatMoney(c.parsed.y ?? 0),
              },
            },
          },
          scales: {
            x: { ticks: { color: text, maxRotation: 0, autoSkipPadding: 8 }, grid: { display: false } },
            y: {
              ticks: { color: text, callback: (v) => formatMoneyShort(Number(v)) },
              grid: { color: grid },
              beginAtZero: true,
            },
          },
        }}
        data={{
          labels,
          datasets: [
            {
              data,
              // Faded bars keep the hue, so the selection doesn't read as a different series.
              backgroundColor: data.map((_, i) => (selected == null || selected === i ? color : `${color}55`)),
              borderRadius: 4,
              borderSkipped: "bottom",
              maxBarThickness: 28,
            },
          ],
        }}
      />
    </div>
  );
}
