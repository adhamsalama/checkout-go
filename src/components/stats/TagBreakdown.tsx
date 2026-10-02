import { IonLabel, IonSegment, IonSegmentButton } from "@ionic/react";
import { useState } from "react";
import { useAsync } from "../../api";
import { getTagSpending, StatsFilter } from "../../api/stats";
import { formatMoney } from "../../format";
import { chartColors } from "../chartTheme";

const TOP = 8;
const STORAGE_KEY = "stats.eachTag";

function loadEachTag() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Spending per tag as horizontal bars. By default each expense counts once under its exact set of
 * tags; "Each tag" counts it in full under every tag, so those rows overlap. Tapping a row filters
 * the screen by its tags.
 */
export function TagBreakdown({
  filter,
  spent,
  version,
  onTags,
}: {
  filter: StatsFilter;
  /** Total spent in the range, for percentages. */
  spent: number;
  version: number;
  onTags: (tags: string[]) => void;
}) {
  const [eachTag, setEachTag] = useState(loadEachTag);
  const { data } = useAsync(() => getTagSpending(filter, eachTag), [JSON.stringify(filter), eachTag, version]);
  const color = chartColors().series[0];

  const setMode = (each: boolean) => {
    setEachTag(each);
    try {
      localStorage.setItem(STORAGE_KEY, each ? "1" : "0");
    } catch {
      // Not remembered; fine.
    }
  };

  const rows = data ?? [];
  const top = rows.slice(0, TOP);
  const rest = rows.slice(TOP);
  const shown = [
    ...top.map((r) => ({ ...r, label: r.tags.length ? r.tags.join(" + ") : "Untagged" })),
    ...(rest.length
      ? [{ tags: null, label: `${rest.length} more`, spent: rest.reduce((s, r) => s + r.spent, 0), count: rest.reduce((s, r) => s + r.count, 0) }]
      : []),
  ];
  const max = Math.max(...shown.map((r) => r.spent), 0);

  return (
    <>
      <div className="section-title">By tag</div>
      <div className="surface ion-padding">
        <IonSegment value={eachTag ? "each" : "sets"} onIonChange={(e) => setMode(e.detail.value === "each")}>
          <IonSegmentButton value="sets">
            <IonLabel>Tag sets</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="each">
            <IonLabel>Each tag</IonLabel>
          </IonSegmentButton>
        </IonSegment>
        <div className="row-sub tag-mode-hint">
          {eachTag
            ? "Expenses with several tags count in full under each, so rows add up to more than the total."
            : "Each expense counts once, under its exact combination of tags."}
        </div>
        {shown.map((r) => {
          const tappable = r.tags !== null && r.tags.length > 0;
          return (
            <button
              type="button"
              key={r.label}
              className="tag-bar-row"
              disabled={!tappable}
              onClick={() => tappable && onTags(r.tags!)}
            >
              <div className="budget-head">
                <span className="row-title">{r.label}</span>
                <span className="amount">{formatMoney(r.spent)}</span>
              </div>
              <div className="tag-bar-track">
                <div className="tag-bar" style={{ width: `${max ? (r.spent / max) * 100 : 0}%`, background: color }} />
              </div>
              <div className="row-sub">
                {spent ? Math.round((r.spent / spent) * 100) : 0}% · {r.count} {r.count === 1 ? "expense" : "expenses"}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
