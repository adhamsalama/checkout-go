import { useAsync } from "../api";
import { getDailyExpenseStats, getMonthlyExpenseStats, getTagsStatistics } from "../api/transactions";
import LineChart from "../components/LineChart";
import BarChart from "../components/PieChart";
function Dashboard() {
  function getMonthData(year: number, month: number) {
    return useAsync(() => getDailyExpenseStats(year, month), [year, month]);
  }
  function getYearData(year: number) {
    return useAsync(() => getMonthlyExpenseStats(year), [year]);
  }

  const { data } = useAsync(getTagsStatistics);
  const months = [
    // "0",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const yearsData: { label: string; data: number[] }[] = [];
  for (let i = 0; i < 3; i++) {
    const { data: yearData } = getYearData(new Date().getFullYear() - i);
    yearsData.push({
      label: (new Date().getFullYear() - i).toString(),
      data: yearData?.map((y) => -y.sum) ?? [],
    });
  }
  const monthsData: { label: string; data: number[] }[] = [];
  for (let i = 0; i < 2; i++) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = first.getFullYear();
    const month = first.getMonth() + 1;
    const { data: monthData } = getMonthData(year, month);
    monthsData.push({
      label: months[month - 1],
      // Index 0 is a placeholder so that index n is day n.
      data: [0].concat(monthData?.map((y) => -y.sum) ?? []),
    });
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        alignContent: "center",
        alignItems: "center",
        margin: "auto",
      }}
    >
      <div
        style={{
          width: "55%",
          height: "55%",
          alignContent: "center",
          alignItems: "center",
          margin: "auto",
        }}
      >
        <BarChart
          label="Expenses by tags"
          labels={data?.map((item) => item.tag) ?? []}
          data={data?.map((item) => -item.sum) ?? []}
        />
      </div>

      <LineChart
        label={`Expenses per month for last ${yearsData.length} years`}
        labels={months}
        datasets={yearsData}
      />
      <LineChart
        label={`Expenses per day for last ${monthsData.length} months`}
        labels={((n: any) => {
          return [...Array(n).keys()];
        })(32)}
        datasets={monthsData}
      />
    </div>
  );
}

export default Dashboard;
