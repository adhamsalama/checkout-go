import { IonButton, IonIcon, IonList, IonProgressBar } from "@ionic/react";
import { search } from "ionicons/icons";
import { useCallback, useState } from "react";
import { useAsync, useDataVersion } from "../api";
import { getMonthlyBudget } from "../api/budgets";
import { getBalance, getCurrentMonthExpensesSum, listExpenses } from "../api/transactions";
import { formatDay, formatMoney } from "../format";
import { Fab } from "./ui/Fab";
import { Page } from "./ui/Page";
import { groupByDay, TransactionRow } from "./ui/TransactionRow";
import { LoadMore, usePagedList } from "./ui/usePagedList";
import { SheetState, TransactionSheet } from "./TransactionSheet";

export function budgetColor(percentLeft: number) {
  if (percentLeft >= 50) return "success";
  if (percentLeft >= 25) return "warning";
  return "danger";
}

function Summary({ version }: { version: number }) {
  const { data: balance } = useAsync(getBalance, [version]);
  const { data: spent } = useAsync(() => getCurrentMonthExpensesSum(), [version]);
  const { data: budget } = useAsync(getMonthlyBudget, [version]);
  const spentAbs = -(spent ?? 0);
  const remaining = budget ? budget.value - spentAbs : 0;
  const percentLeft = budget ? (remaining / budget.value) * 100 : 0;

  return (
    <div className="surface ion-padding">
      <div className="stat-label">Balance</div>
      <div className="balance-value">{balance === null ? "…" : formatMoney(balance)}</div>
      <div className="stat-row">
        <div>
          <div className="stat-label">Spent this month</div>
          <div className="stat-value">{formatMoney(spentAbs)}</div>
        </div>
        {budget && (
          <div className="ion-text-end">
            <div className="stat-label">{remaining >= 0 ? "Left in budget" : "Over budget"}</div>
            <div className={`stat-value ${remaining < 0 ? "danger" : ""}`}>{formatMoney(Math.abs(remaining))}</div>
          </div>
        )}
      </div>
      {budget && (
        <IonProgressBar
          className="budget-bar"
          color={budgetColor(percentLeft)}
          value={Math.min(1, spentAbs / budget.value)}
          aria-label="Monthly budget used"
        />
      )}
    </div>
  );
}

export function ListExpenses() {
  const version = useDataVersion();
  const [sheet, setSheet] = useState<SheetState>(null);
  const list = usePagedList(listExpenses, version);
  const { items } = list;
  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <Page
      title="Expenses"
      actions={
        <IonButton aria-label="Search" routerLink="/expenses/search">
          <IonIcon slot="icon-only" icon={search} />
        </IonButton>
      }
      fab={<Fab label="Add expense" onClick={() => setSheet({ kind: "expense" })} />}
    >
      <Summary version={version} />
      {items?.length === 0 && <div className="empty-state">No expenses yet. Tap + to add one.</div>}
      {items &&
        groupByDay(items).map((group) => (
          <section key={group.day}>
            <div className="section-title">
              <span>{formatDay(group.day)}</span>
              <span>{formatMoney(group.items.reduce((sum, t) => sum + t.price, 0))}</span>
            </div>
            <IonList className="list">
              {group.items.map((t) => (
                <TransactionRow key={t.id} t={t} onClick={() => setSheet({ kind: "expense", transaction: t })} />
              ))}
            </IonList>
          </section>
        ))}
      <LoadMore list={list} />
      <TransactionSheet state={sheet} onClose={closeSheet} />
    </Page>
  );
}
