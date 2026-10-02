import { useCallback, useEffect, useState } from "react";
import { useAsync, useDataVersion } from "../api";
import { getStatsSummary, StatsFilter } from "../api/stats";
import { toDateInput } from "../dates";
import { FilterBar } from "./stats/FilterBar";
import { TopNames, WeekdaySpending } from "./stats/Habits";
import { BalanceForecast } from "./stats/BalanceForecast";
import { RangeBar } from "./stats/RangeBar";
import { comparisonRange, elapsed, initialRange, Preset, RangeState, resolveRange, stepRange } from "./stats/range";
import { RunningTotal } from "./stats/RunningTotal";
import { SpendingOverTime } from "./stats/SpendingOverTime";
import { countDays, Summary } from "./stats/Summary";
import { TagBreakdown } from "./stats/TagBreakdown";
import { YearOverYear } from "./stats/YearOverYear";
import { Page } from "./ui/Page";
import { useDebounced } from "./ui/useDebounced";
import { SheetState, TransactionSheet } from "./TransactionSheet";

const STORAGE_KEY = "stats.range";

/** The last preset (and custom dates), always anchored on today when the app opens. */
function loadRange(): RangeState {
  const fresh = initialRange();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<RangeState> | null;
    const presets: Preset[] = ["month", "3m", "year", "all", "custom"];
    if (!saved || !presets.includes(saved.preset as Preset)) return fresh;
    const custom = saved.preset === "custom" && saved.from && saved.to && saved.from <= saved.to;
    return { ...fresh, preset: saved.preset!, ...(custom && { from: saved.from, to: saved.to }) };
  } catch {
    return fresh;
  }
}

function Dashboard() {
  const version = useDataVersion();
  const today = toDateInput(new Date());
  const [rangeState, setRangeState] = useState(loadRange);
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const closeSheet = useCallback(() => setSheet(null), []);

  useEffect(() => {
    try {
      const { preset, from, to } = rangeState;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, from, to }));
    } catch {
      // Not remembered; fine.
    }
  }, [rangeState]);

  const range = resolveRange(rangeState);
  const debouncedQuery = useDebounced(query, 250);
  const filter: StatsFilter = { from: range.from, to: range.to, query: debouncedQuery, tags };
  const { data: summary } = useAsync(() => getStatsSummary(filter), [JSON.stringify(filter), version]);

  // "All" starts at the first matching expense; every range stops at today for averages and charts.
  const span = elapsed(range, today);
  const from = span.from ?? summary?.firstDay ?? today;
  const to = span.to ?? today;
  const days = countDays(from, to);
  const runningMonth = rangeState.preset === "month" && range.from! <= today && range.to! >= today;

  return (
    <Page title="Stats">
      <RangeBar state={rangeState} onChange={setRangeState} today={today} />
      <FilterBar query={query} onQuery={setQuery} tags={tags} onTags={setTags} />
      {summary && (
        <Summary
          summary={summary}
          filter={filter}
          days={days}
          comparison={comparisonRange(rangeState, today)}
          projectTo={runningMonth ? Number(range.to!.slice(8, 10)) : undefined}
          version={version}
        />
      )}
      {summary && summary.count === 0 && (
        <div className="empty-state">
          {debouncedQuery || tags.length ? "No matching expenses in this range." : "No expenses in this range."}
        </div>
      )}
      {summary && summary.count > 0 && days > 0 && (
        <>
          <SpendingOverTime
            filter={filter}
            from={from}
            to={to}
            total={summary.count}
            version={version}
            onOpen={setSheet}
          />
          {rangeState.preset === "month" && (
            <RunningTotal
              filter={filter}
              month={range}
              previous={resolveRange(stepRange(rangeState, -1))}
              today={today}
              version={version}
            />
          )}
          <TagBreakdown filter={filter} spent={summary.spent} version={version} onTags={setTags} />
          {days >= 7 && <WeekdaySpending filter={filter} from={from} to={to} version={version} />}
          <TopNames filter={filter} version={version} onName={setQuery} />
        </>
      )}
      <YearOverYear filter={{ query: debouncedQuery, tags }} version={version} onOpen={setSheet} />
      <BalanceForecast today={today} version={version} />
      <TransactionSheet state={sheet} onClose={closeSheet} />
    </Page>
  );
}

export default Dashboard;
