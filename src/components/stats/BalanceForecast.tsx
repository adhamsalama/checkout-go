import { useAsync } from "../../api";
import { getBalanceForecast } from "../../api/forecast";
import { formatMoney } from "../../format";
import LineChart from "../LineChart";

const monthLabel = (month: string) =>
  new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });

/**
 * The total balance over the last year and where it's heading at the average monthly net.
 * Ignores the date range, search and tags.
 */
export function BalanceForecast({ today, version }: { today: string; version: number }) {
  const { data } = useAsync(() => getBalanceForecast(today), [today, version]);
  if (!data) return null;

  const { history, projection, averageNet, months } = data;
  // The projection starts at the current month, so both lines meet there.
  const labels = [...history, ...projection.slice(1)].map((p) => monthLabel(p.month));
  const gap = Array<null>(history.length - 1).fill(null);
  const end = projection[projection.length - 1];

  return (
    <>
      <div className="section-title">Balance forecast</div>
      <div className="surface ion-padding">
        <LineChart
          labels={labels}
          datasets={[
            { label: "Balance", data: history.map((p) => p.balance) },
            ...(projection.length
              ? [{ label: "Projected", data: [...gap, ...projection.map((p) => p.balance)], muted: true, dashed: true }]
              : []),
          ]}
        />
        <div className="row-sub chart-hint">
          {averageNet === null
            ? "Needs a full month of data to project."
            : `At ${averageNet >= 0 ? "+" : ""}${formatMoney(averageNet)} a month (average of the last ${
                months === 1 ? "month" : `${months} months`
              }), about ${formatMoney(end.balance)} by ${monthLabel(end.month)}. All accounts.`}
        </div>
      </div>
    </>
  );
}
