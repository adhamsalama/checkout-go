import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { formatMoney } from "../format";
import { PALETTE } from "./chartTheme";

ChartJS.register(ArcElement, Tooltip);

export default function PieChart({ labels, data }: { labels: string[]; data: number[] }) {
  return (
    <div className="chart-box" style={{ height: 200 }}>
      <Doughnut
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => formatMoney(c.parsed) } } },
        }}
        data={{
          labels,
          datasets: [
            {
              data,
              backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length]),
              borderWidth: 0,
            },
          ],
        }}
      />
    </div>
  );
}
