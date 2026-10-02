import { IonList } from "@ionic/react";
import { useCallback, useState } from "react";
import { useAsync, useDataVersion } from "../api";
import { getCurrentMonthIncomeSum, listPayments } from "../api/transactions";
import { formatMoney } from "../format";
import { Fab } from "./ui/Fab";
import { Page } from "./ui/Page";
import { TransactionRow } from "./ui/TransactionRow";
import { LoadMore, usePagedList } from "./ui/usePagedList";
import { SheetState, TransactionSheet } from "./TransactionSheet";

export default function PaymentPage() {
  const version = useDataVersion();
  const [sheet, setSheet] = useState<SheetState>(null);
  const list = usePagedList(listPayments, version);
  const { items } = list;
  const { data: monthTotal } = useAsync(() => getCurrentMonthIncomeSum(), [version]);
  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <Page title="Payments" fab={<Fab label="Add payment" onClick={() => setSheet({ kind: "payment" })} />}>
      <div className="surface ion-padding">
        <div className="stat-label">Received this month</div>
        <div className="balance-value">{monthTotal === null ? "…" : formatMoney(monthTotal)}</div>
      </div>
      {items?.length === 0 && <div className="empty-state">No payments yet. Tap + to add income.</div>}
      {items && items.length > 0 && (
        <IonList className="list section-gap">
          {items.map((t) => (
            <TransactionRow
              key={t.id}
              t={t}
              showDate
              onClick={() => setSheet({ kind: "payment", transaction: t })}
            />
          ))}
        </IonList>
      )}
      <LoadMore list={list} />
      <TransactionSheet state={sheet} onClose={closeSheet} />
    </Page>
  );
}
