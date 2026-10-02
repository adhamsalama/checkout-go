import { Expense } from "../../types";
import { formatDay, formatMoney } from "../../format";

/** A list row for an expense or payment. */
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
    <button className="row-item" onClick={onClick}>
      <div className="row-main">
        <div className="row-title">{t.name || "Untitled"}</div>
        {details && <div className="row-sub">{details}</div>}
        {t.tags.length > 0 && (
          <div className="mt-1">
            {t.tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={`amount ${t.price < 0 ? "expense" : "income"}`}>
        {t.price < 0 ? formatMoney(t.price) : `+${formatMoney(t.price)}`}
      </div>
    </button>
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
