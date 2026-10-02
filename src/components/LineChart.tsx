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
import { formatMoney } from "../format";
import { chartColors, PALETTE } from "./chartTheme";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export default function LineChart({
  labels,
  datasets,
}: {
  labels: (string | number)[];
  datasets: { label: string; data: number[] }[];
}) {
  const { text, grid } = chartColors();
  return (
    <div className="chart-box">
      <Line
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { position: "bottom", labels: { color: text, boxWidth: 12 } },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatMoney(c.parsed.y ?? 0)}` } },
          },
          scales: {
            x: { ticks: { color: text, maxRotation: 0, autoSkipPadding: 8 }, grid: { display: false } },
            y: { ticks: { color: text }, grid: { color: grid }, beginAtZero: true },
          },
        }}
        data={{
          labels,
          datasets: datasets.map((d, i) => ({
            ...d,
            borderColor: PALETTE[i % PALETTE.length],
            backgroundColor: PALETTE[i % PALETTE.length],
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 12,
            cubicInterpolationMode: "monotone" as const,
          })),
        }}
      />
    </div>
  );
}
