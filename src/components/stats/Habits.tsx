import { IonItem, IonLabel, IonList } from "@ionic/react";
import { useAsync } from "../../api";
import { getTopNames, getWeekdaySpending, StatsFilter } from "../../api/stats";
import { formatMoney } from "../../format";
import BarChart from "../BarChart";
import { weekdayCounts } from "./range";

// 2024-01-01 is a Monday; formatting the week after it gives localized weekday names, Monday first.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" })
);

/** Average spending per weekday over the elapsed days `from`–`to`. */
export function WeekdaySpending({
  filter,
  from,
  to,
  version,
}: {
  filter: StatsFilter;
  from: string;
  to: string;
  version: number;
}) {
  const { data } = useAsync(() => getWeekdaySpending({ ...filter, from, to }), [JSON.stringify([filter, from, to]), version]);
  if (!data) return null;
  const counts = weekdayCounts(from, to);
  return (
    <>
      <div className="section-title">Average by weekday</div>
      <div className="surface ion-padding">
        <BarChart labels={WEEKDAYS} data={data.map((total, i) => (counts[i] ? total / counts[i] : 0))} height={180} />
      </div>
    </>
  );
}

/** The most frequent expense names; tapping one searches for it. */
export function TopNames({
  filter,
  version,
  onName,
}: {
  filter: StatsFilter;
  version: number;
  onName: (name: string) => void;
}) {
  const { data } = useAsync(() => getTopNames(filter, 5), [JSON.stringify(filter), version]);
  // A single name (e.g. while searching for it) isn't worth a section.
  if (!data || data.length < 2) return null;
  return (
    <>
      <div className="section-title">Most frequent</div>
      <IonList className="list">
        {data.map((n) => (
          <IonItem key={n.name} button detail={false} onClick={() => onName(n.name)}>
            <IonLabel>
              <h2 className="row-title">{n.name}</h2>
              <p>
                {n.count}× · {formatMoney(n.spent / n.count)} average
              </p>
            </IonLabel>
            <div slot="end" className="amount">
              {formatMoney(n.spent)}
            </div>
          </IonItem>
        ))}
      </IonList>
    </>
  );
}
