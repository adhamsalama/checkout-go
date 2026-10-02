import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  Title,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement
);

export default function LineChart({
  label,
  labels,
  datasets,
}: {
  label: string;
  labels: (string | number)[];
  datasets: {
    label: string;
    // labels: string[];
    data: number[];
  }[];
}) {
  const options = {
    responsive: true,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    stacked: false,
    plugins: {
      title: {
        display: true,
        text: label,
      },
    },
    scales: {
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
      },
      // y1: {
      //   type: "linear" as const,
      //   display: true,
      //   position: "right" as const,
      //   grid: {
      //     drawOnChartArea: false,
      //   },
      // },
    },
  };
  return (
    <Line
      options={options}
      data={{
        labels,
        datasets: datasets.map((line, index) => {
          return {
            label: line.label,
            data: line.data,
            backgroundColor: `rgb(${Math.random() * (index + 1) * 100},${
              Math.random() * (index + 1) * 200
            },${Math.random() * (index + 1) * 255} )`,
          };
        }),
        // datasets: [
        //   {
        //     label,
        //     data,
        //     backgroundColor: `rgb(${Math.random() * 255},${
        //       Math.random() * 255
        //     },${Math.random() * 255} )`,
        //   },
        // ],
      }}
    />
  );
}
