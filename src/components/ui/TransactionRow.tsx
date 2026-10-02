import { IonItem, IonLabel } from "@ionic/react";
import { Expense } from "../../types";
import { formatDay, formatMoney } from "../../format";

/** A list row for an expense or payment; render inside an IonList. */
export function TransactionRow({
  t,
  onClick,
  showDate,
}: {
  t: Expense;
  onClick: () => void;
  showDate?: boolean;
}) {
  const details = [showDate && formatDay(t.date), t.sellerName, t.comment].filter(Boolean).join(" · ");
  return (
    <IonItem button detail={false} onClick={onClick}>
      <IonLabel>
        <h2 className="row-title">{t.name || "Untitled"}</h2>
        {details && <p>{details}</p>}
        {t.tags.length > 0 && (
          <div className="row-tags">
            {t.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </IonLabel>
      <div slot="end" className={`amount ${t.price < 0 ? "expense" : "income"}`}>
        {t.price < 0 ? formatMoney(t.price) : `+${formatMoney(t.price)}`}
      </div>
    </IonItem>
  );
}

/** Groups transactions (already sorted newest first) by calendar day. */
export function groupByDay(items: Expense[]): { day: string; items: Expense[] }[] {
  const groups: { day: string; items: Expense[] }[] = [];
  for (const t of items) {
    const day = t.date.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(t);
    else groups.push({ day, items: [t] });
  }
  return groups;
}
