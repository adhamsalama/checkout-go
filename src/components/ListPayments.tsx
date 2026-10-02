import { useCallback, useState } from "react";
import { useAsync } from "../api";
import { getCurrentMonthIncomeSum, listPayments } from "../api/transactions";
import { formatMoney } from "../format";
import { Fab } from "./ui/Fab";
import { Page } from "./ui/Page";
import { TransactionRow } from "./ui/TransactionRow";
import { usePagedList } from "./ui/usePagedList";
import { SheetState, TransactionSheet } from "./TransactionSheet";

export default function PaymentPage() {
  const [sheet, setSheet] = useState<SheetState>(null);
  const [version, setVersion] = useState(0);
  const { items, done, sentinel, reset } = usePagedList(listPayments);
  const { data: monthTotal } = useAsync(() => getCurrentMonthIncomeSum(), [version]);
  const closeSheet = useCallback(() => setSheet(null), []);
  const onSaved = useCallback(() => {
    setVersion((v) => v + 1);
    reset();
  }, [reset]);

  return (
    <Page title="Payments">
      <div className="surface p-3 mb-3">
        <div className="stat-label">Received this month</div>
        <div className="balance-value">{monthTotal === null ? "…" : formatMoney(monthTotal)}</div>
      </div>
      {items?.length === 0 && <div className="empty-state">No payments yet. Tap + to add income.</div>}
      {items && items.length > 0 && (
        <div className="list">
          {items.map((t) => (
            <TransactionRow
              key={t.id}
              t={t}
              showDate
              onClick={() => setSheet({ kind: "payment", transaction: t })}
            />
          ))}
        </div>
      )}
      {!done && <div ref={sentinel} className="empty-state">Loading…</div>}
      <Fab label="Add payment" onClick={() => setSheet({ kind: "payment" })} />
      <TransactionSheet state={sheet} onClose={closeSheet} onSaved={onSaved} />
    </Page>
  );
}
