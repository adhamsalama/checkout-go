import { useState } from "react";
import { useAsync } from "../../api";
import { getSpendingSeries, StatsFilter } from "../../api/stats";
import { toDateInput } from "../../dates";
import LineChart from "../LineChart";
import { SheetState } from "../TransactionSheet";
import { LargestExpenses } from "./LargestExpenses";

const YEARS = 3;
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString(undefined, { month: "short" }));

/**
 * Monthly spending of the last three years on one chart, ignoring the date range but not the
 * search or tags. Tapping a month lists each year's biggest expenses in it.
 */
export function YearOverYear({
  filter,
  version,
  onOpen,
}: {
  filter: Pick<StatsFilter, "query" | "tags">;
  version: number;
  onOpen: (sheet: SheetState) => void;
}) {
  const now = new Date();
  const years = Array.from({ length: YEARS }, (_, i) => now.getFullYear() - i);
  const { data } = useAsync(
    () => Promise.all(years.map((y) => getSpendingSeries({ ...filter, from: `${y}-01-01`, to: `${y}-12-31` }, "month"))),
    [JSON.stringify(filter), version]
  );
  const [month, setMonth] = useState<number | null>(null);
  if (!data) return null;

  const shown = years
    .map((year, i) => ({ year, points: data[i] }))
    // Older years without any spending would just be a flat line at zero.
    .filter((y, i) => i === 0 || y.points.some((p) => p.count > 0));
  const withExpenses = month === null ? [] : shown.filter((y) => y.points[month].count > 0);

  return (
    <>
      <div className="section-title">Year over year</div>
      <div className="surface ion-padding">
        <LineChart
          labels={MONTHS}
          selected={month}
          onSelect={(i) => setMonth(i === month ? null : i)}
          datasets={shown.map(({ year, points }, i) => ({
            label: String(year),
            // Don't draw future months of the current year as zero spending.
            data: points.slice(0, i === 0 ? now.getMonth() + 1 : 12).map((p) => p.spent),
          }))}
        />
        <div className="row-sub chart-hint">
          {month === null
            ? "Tap a month to compare its biggest expenses across years."
            : `Biggest expenses in ${MONTHS[month]}, by year`}
        </div>
      </div>
      {month !== null && withExpenses.length === 0 && <div className="empty-state">No expenses in {MONTHS[month]}.</div>}
      {month !== null &&
        withExpenses.map(({ year, points }) => (
          <LargestExpenses
            key={year}
            title={
              <span>
                {MONTHS[month]} {year}
              </span>
            }
            filter={{
              ...filter,
              from: points[month].start,
              to: toDateInput(new Date(year, month + 1, 0)),
            }}
            total={points[month].count}
            version={version}
            onOpen={onOpen}
          />
        ))}
    </>
  );
}
