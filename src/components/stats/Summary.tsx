import { useAsync } from "../../api";
import { getStatsSummary, StatsFilter, StatsSummary } from "../../api/stats";
import { daysBetween } from "../../dates";
import { formatDay, formatMoney } from "../../format";
import { Range } from "./range";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="row-sub">{sub}</div>}
    </div>
  );
}

/**
 * Headline numbers for the range. `days` are the elapsed days the averages cover, and `comparison`
 * is the previous period to compare spending with.
 */
export function Summary({
  summary,
  filter,
  days,
  comparison,
  projectTo,
  version,
}: {
  summary: StatsSummary;
  filter: StatsFilter;
  days: number;
  comparison: Range | null;
  /** Days in the whole period, when it's a running month worth projecting. */
  projectTo?: number;
  version: number;
}) {
  const { data: previous } = useAsync(
    () => (comparison ? getStatsSummary({ ...filter, from: comparison.from, to: comparison.to }) : Promise.resolve(null)),
    [JSON.stringify(filter), JSON.stringify(comparison), version]
  );
  const { spent, count, income, activeDays, biggestDay } = summary;
  const filtered = Boolean(filter.query?.trim() || filter.tags?.length);
  const change = previous && previous.spent > 0 ? ((spent - previous.spent) / previous.spent) * 100 : null;
  const saved = income > 0 ? Math.round(((income - spent) / income) * 100) : null;

  return (
    <div className="surface ion-padding">
      <div className="stat-label">{filtered ? "Spent on matching expenses" : "Spent"}</div>
      <div className="balance-value">{formatMoney(spent)}</div>
      {comparison && previous && (
        <div className="row-sub">
          {change === null
            ? `Nothing spent in ${comparison.label}`
            : `${change >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(change))}% vs ${comparison.label} (${formatMoney(previous.spent)})`}
        </div>
      )}
      <div className="tile-grid">
        {!filtered && <Tile label="Income" value={formatMoney(income)} sub={saved === null ? undefined : `${saved}% saved`} />}
        <Tile label="Per day" value={formatMoney(days > 0 ? spent / days : 0)} sub={`over ${days} ${days === 1 ? "day" : "days"}`} />
        <Tile label="Expenses" value={String(count)} sub={count > 0 ? `${formatMoney(spent / count)} average` : undefined} />
        {projectTo && days >= 3 && (
          <Tile label="Projected" value={formatMoney((spent / days) * projectTo)} sub="by month end at this pace" />
        )}
        {biggestDay && <Tile label="Biggest day" value={formatMoney(biggestDay.spent)} sub={formatDay(biggestDay.day)} />}
        {days > 0 && (
          <Tile
            label="No-spend days"
            value={String(Math.max(0, days - activeDays))}
            sub={`of ${days}`}
          />
        )}
      </div>
    </div>
  );
}

/** Elapsed days from `from` to `to`, inclusive; 0 if the range hasn't started. */
export function countDays(from: string | null | undefined, to: string): number {
  return from && from <= to ? daysBetween(from, to) + 1 : 0;
}
