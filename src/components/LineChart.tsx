import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatMoney, formatMoneyShort } from "../format";
import { chartColors } from "./chartTheme";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export type LineDataset = {
  label: string;
  /** null leaves a gap, e.g. before a projection starts. */
  data: (number | null)[];
  /** A recessive grey line, for comparison or reference series. */
  muted?: boolean;
  dashed?: boolean;
};

export default function LineChart({
  labels,
  datasets,
  selected,
  onSelect,
}: {
  labels: (string | number)[];
  datasets: LineDataset[];
  /** Index of the label to mark with points. */
  selected?: number | null;
  /** Called with the label index of a tap anywhere in its column. */
  onSelect?: (index: number) => void;
}) {
  const { text, grid, muted, series } = chartColors();
  let next = 0;
  return (
    <div className="chart-box">
      <Line
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
            legend: { position: "bottom", labels: { color: text, boxWidth: 12 } },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatMoney(c.parsed.y ?? 0)}` } },
          },
          scales: {
            x: { ticks: { color: text, maxRotation: 0, autoSkipPadding: 8 }, grid: { display: false } },
            y: { ticks: { color: text, callback: (v) => formatMoneyShort(Number(v)) }, grid: { color: grid }, beginAtZero: true },
          },
        }}
        data={{
          labels,
          datasets: datasets.map(({ muted: isMuted, dashed, ...d }) => {
            // Coloured series take the palette in order, so muted ones don't use up a slot.
            const color = isMuted ? muted : series[next++ % series.length];
            return {
              ...d,
              borderColor: color,
              backgroundColor: color,
              borderWidth: 2,
              borderDash: dashed ? [6, 4] : undefined,
              pointRadius: (c: { dataIndex: number }) => (c.dataIndex === selected ? 5 : 0),
              pointHitRadius: 12,
              cubicInterpolationMode: "monotone" as const,
            };
          }),
        }}
      />
    </div>
  );
}
