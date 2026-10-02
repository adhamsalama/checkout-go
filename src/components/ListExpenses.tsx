import { useCallback, useState } from "react";
import ProgressBar from "react-bootstrap/ProgressBar";
import { Search } from "react-bootstrap-icons";
import { useNavigate } from "react-router-dom";
import { useAsync } from "../api";
import { getMonthlyBudget } from "../api/budgets";
import { getBalance, getCurrentMonthExpensesSum, listExpenses } from "../api/transactions";
import { formatDay, formatMoney } from "../format";
import { Fab } from "./ui/Fab";
import { Page } from "./ui/Page";
import { groupByDay, TransactionRow } from "./ui/TransactionRow";
import { usePagedList } from "./ui/usePagedList";
import { SheetState, TransactionSheet } from "./TransactionSheet";

export function budgetVariant(percentLeft: number) {
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
    <div className="surface p-3">
      <div className="stat-label">Balance</div>
      <div className="balance-value">{balance === null ? "…" : formatMoney(balance)}</div>
      <div className="d-flex mt-3 gap-3">
        <div className="flex-fill">
          <div className="stat-label">Spent this month</div>
          <div className="stat-value">{formatMoney(spentAbs)}</div>
        </div>
        {budget && (
          <div className="flex-fill text-end">
            <div className="stat-label">{remaining >= 0 ? "Left in budget" : "Over budget"}</div>
            <div className={`stat-value ${remaining < 0 ? "text-danger" : ""}`}>
              {formatMoney(Math.abs(remaining))}
            </div>
          </div>
        )}
      </div>
      {budget && (
        <ProgressBar
          className="mt-2"
          style={{ height: 8 }}
          variant={budgetVariant(percentLeft)}
          now={Math.min(100, (spentAbs / budget.value) * 100)}
          aria-label="Monthly budget used"
        />
      )}
    </div>
  );
}

export function ListExpenses() {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [version, setVersion] = useState(0);
  const { items, done, sentinel, reset } = usePagedList(listExpenses);
  const closeSheet = useCallback(() => setSheet(null), []);
  const onSaved = useCallback(() => {
    setVersion((v) => v + 1);
    reset();
  }, [reset]);

  return (
    <Page
      title="Expenses"
      actions={
        <button className="icon-btn" aria-label="Search" onClick={() => navigate("/search")}>
          <Search size={20} />
        </button>
      }
    >
      <Summary version={version} />
      {items?.length === 0 && <div className="empty-state">No expenses yet. Tap + to add one.</div>}
      {items &&
        groupByDay(items).map((group) => (
          <section key={group.day}>
            <div className="section-title d-flex justify-content-between">
              <span>{formatDay(group.day)}</span>
              <span>{formatMoney(group.items.reduce((sum, t) => sum + t.price, 0))}</span>
            </div>
            <div className="list">
              {group.items.map((t) => (
                <TransactionRow key={t.id} t={t} onClick={() => setSheet({ kind: "expense", transaction: t })} />
              ))}
            </div>
          </section>
        ))}
      {!done && <div ref={sentinel} className="empty-state">Loading…</div>}
      <Fab label="Add expense" onClick={() => setSheet({ kind: "expense" })} />
      <TransactionSheet state={sheet} onClose={closeSheet} onSaved={onSaved} />
    </Page>
  );
}
