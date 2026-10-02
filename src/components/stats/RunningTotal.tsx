import { useAsync } from "../../api";
import { getMonthlyBudget } from "../../api/budgets";
import { getSpendingSeries, StatsFilter } from "../../api/stats";
import LineChart, { LineDataset } from "../LineChart";
import { Range } from "./range";

const cumulative = (values: number[]) => {
  let sum = 0;
  return values.map((v) => (sum += v));
};

/** Month-to-date spending against the previous month and the monthly budget. */
export function RunningTotal({
  filter,
  month,
  previous,
  today,
  version,
}: {
  filter: StatsFilter;
  month: Range;
  previous: Range;
  today: string;
  version: number;
}) {
  const filtered = Boolean(filter.query?.trim() || filter.tags?.length);
  const { data } = useAsync(async () => {
    const to = month.to! > today ? today : month.to!;
    const [current, before, budget] = await Promise.all([
      month.from! <= to ? getSpendingSeries({ ...filter, from: month.from!, to }, "day") : Promise.resolve([]),
      getSpendingSeries({ ...filter, from: previous.from!, to: previous.to! }, "day"),
      filtered ? Promise.resolve(null) : getMonthlyBudget(),
    ]);
    return { current, before, budget };
  }, [JSON.stringify([filter, month, previous]), today, version]);
  if (!data) return null;

  const daysInMonth = Number(month.to!.slice(8, 10));
  const length = Math.max(daysInMonth, data.before.length);
  const datasets: LineDataset[] = [
    { label: month.label, data: cumulative(data.current.map((p) => p.spent)) },
    { label: previous.label, data: cumulative(data.before.map((p) => p.spent)), muted: true },
  ];
  if (data.budget) {
    datasets.push({ label: "Budget", data: Array(length).fill(data.budget.value), muted: true, dashed: true });
  }
  return (
    <>
      <div className="section-title">Running total</div>
      <div className="surface ion-padding">
        <LineChart labels={Array.from({ length }, (_, i) => i + 1)} datasets={datasets} />
      </div>
    </>
  );
}
