import { IonChip, IonIcon } from "@ionic/react";
import { closeCircle } from "ionicons/icons";
import { useState } from "react";
import { useAsync } from "../../api";
import { getSpendingSeries, nextBucket, StatsFilter } from "../../api/stats";
import { addDays } from "../../dates";
import BarChart from "../BarChart";
import { SheetState } from "../TransactionSheet";
import { LargestExpenses } from "./LargestExpenses";
import { bucketFor, bucketLabels } from "./range";

/**
 * Spending per day, week, month or year across `from`–`to`, then the biggest expenses: of the
 * tapped bar, or of the whole range.
 */
export function SpendingOverTime({
  filter,
  from,
  to,
  total,
  version,
  onOpen,
}: {
  filter: StatsFilter;
  from: string;
  to: string;
  total: number;
  version: number;
  onOpen: (sheet: SheetState) => void;
}) {
  const bucket = bucketFor(from, to);
  const key = JSON.stringify([filter, from, to]);
  const { data: points } = useAsync(() => getSpendingSeries({ ...filter, from, to }, bucket), [key, version]);
  // The selection belongs to one range and filter; a change clears it.
  const [selected, setSelected] = useState<{ key: string; index: number } | null>(null);
  const index = selected?.key === key ? selected.index : null;

  const multiYear = from.slice(0, 4) !== to.slice(0, 4);
  const labels = (points ?? []).map((p) => bucketLabels(p.start, bucket, multiYear));
  const point = index === null ? null : points?.[index];
  // Clip the tapped bucket to the range, since the first and last buckets can stick out of it.
  const scope = point && {
    ...filter,
    from: point.start < from ? from : point.start,
    to: addDays(nextBucket(point.start, bucket), -1) > to ? to : addDays(nextBucket(point.start, bucket), -1),
  };

  return (
    <>
      <div className="section-title">Spending by {bucket}</div>
      <div className="surface ion-padding">
        {points && (
          <BarChart
            labels={labels.map((l) => l.short)}
            titles={labels.map((l) => l.full)}
            data={points.map((p) => p.spent)}
            selected={index}
            onSelect={(i) => setSelected(i === index ? null : { key, index: i })}
          />
        )}
        <div className="row-sub chart-hint">Tap a bar to see its biggest expenses.</div>
      </div>
      <LargestExpenses
        title={
          point ? (
            <IonChip className="scope-chip" onClick={() => setSelected(null)}>
              {labels[index!].full}
              <IonIcon icon={closeCircle} aria-label="Show the whole range" />
            </IonChip>
          ) : (
            <span>Biggest expenses</span>
          )
        }
        filter={scope ?? { ...filter, from, to }}
        total={point ? point.count : total}
        version={version}
        onOpen={onOpen}
      />
    </>
  );
}
