import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function PieChart({
  label,
  labels,
  data,
}: {
  label: string;
  labels: string[];
  data: number[];
}) {
  return (
    <Doughnut
      data={{
        labels,
        datasets: [
          {
            label,
            data,
            backgroundColor: data.map(
              (item) =>
                `rgb(${Math.random() * 255},${Math.random() * 255},${
                  Math.random() * 255
                } )`
            ),
          },
        ],
      }}
    />
  );
}
