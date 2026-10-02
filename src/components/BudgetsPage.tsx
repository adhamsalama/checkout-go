import { useCallback, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import ProgressBar from "react-bootstrap/ProgressBar";
import { alertError, useAsync } from "../api";
import {
  createTaggedBudget,
  deleteMonthlyBudget,
  deleteTaggedBudget,
  getMonthlyBudget,
  getTaggedBudgetStats,
  saveMonthlyBudget,
  updateTaggedBudget,
} from "../api/budgets";
import { getAllTags, getCurrentMonthExpensesSum } from "../api/transactions";
import { formatMoney, parseAmount } from "../format";
import { TaggedBudgetStats } from "../types";
import { budgetVariant } from "./ListExpenses";
import { Fab } from "./ui/Fab";
import { Page } from "./ui/Page";
import { Sheet } from "./ui/Sheet";

function BudgetProgress({ name, sub, value, spent, onClick }: {
  name: string;
  sub?: string;
  value: number;
  spent: number;
  onClick: () => void;
}) {
  const remaining = value - spent;
  const percentLeft = (remaining / value) * 100;
  return (
    <button className="row-item d-block" onClick={onClick}>
      <div className="d-flex justify-content-between align-items-baseline gap-2">
        <div className="row-main">
          <div className="row-title">{name}</div>
          {sub && <div className="row-sub">{sub}</div>}
        </div>
        <div className="text-end">
          <div className="amount">{formatMoney(spent)}</div>
          <div className="row-sub">of {formatMoney(value)}</div>
        </div>
      </div>
      <ProgressBar
        className="mt-2"
        style={{ height: 8 }}
        variant={budgetVariant(percentLeft)}
        now={Math.min(100, (spent / value) * 100)}
      />
      <div className={`row-sub mt-1 ${remaining < 0 ? "text-danger" : ""}`}>
        {remaining >= 0 ? `${formatMoney(remaining)} left` : `${formatMoney(-remaining)} over`}
      </div>
    </button>
  );
}

type Editing =
  | { kind: "monthly" }
  | { kind: "tagged"; budget?: TaggedBudgetStats }
  | null;

function BudgetSheet({ editing, hasMonthly, onClose, onSaved }: {
  editing: Editing;
  hasMonthly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: knownTags } = useAsync(getAllTags);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [tag, setTag] = useState("");

  const monthly = useAsync(getMonthlyBudget, [editing]);
  useEffect(() => {
    if (!editing) return;
    if (editing.kind === "monthly") {
      setName(monthly.data?.name ?? "Monthly budget");
      setValue(monthly.data ? String(monthly.data.value) : "");
    } else {
      setName(editing.budget?.name ?? "");
      setValue(editing.budget ? String(editing.budget.value) : "");
      setTag(editing.budget?.tag ?? "");
    }
  }, [editing, monthly.data]);

  const isTagged = editing?.kind === "tagged";
  const existing = editing?.kind === "tagged" ? editing.budget : hasMonthly;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(value);
    try {
      if (editing?.kind === "monthly") {
        await saveMonthlyBudget({ name: name.trim() || "Monthly budget", value: amount });
      } else if (editing?.kind === "tagged") {
        const input = { name: name.trim() || tag.trim(), value: amount, tag };
        if (editing.budget) await updateTaggedBudget(editing.budget.id, input);
        else await createTaggedBudget(input);
      }
      onSaved();
      onClose();
    } catch (err) {
      alertError(err);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this budget?")) return;
    try {
      if (editing?.kind === "monthly") await deleteMonthlyBudget();
      else if (editing?.kind === "tagged" && editing.budget) await deleteTaggedBudget(editing.budget.id);
      onSaved();
      onClose();
    } catch (err) {
      alertError(err);
    }
  };

  const title = isTagged ? (existing ? "Edit tag budget" : "New tag budget") : "Monthly budget";
  return (
    <Sheet show={editing !== null} onClose={onClose} title={title}>
      <Form onSubmit={save}>
        <Form.Control
          className="amount-input mb-2"
          aria-label="Budget amount"
          placeholder="0.00"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {isTagged && (
          <Form.Group className="mb-3">
            <Form.Label>Tag</Form.Label>
            <div className="mb-2">
              {(knownTags ?? []).map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`chip${t === tag ? " selected" : ""}`}
                  onClick={() => setTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <Form.Control placeholder="Tag" value={tag} onChange={(e) => setTag(e.target.value)} />
            <Form.Text>Counts this month's expenses with this tag.</Form.Text>
          </Form.Group>
        )}
        <Form.Group className="mb-3">
          <Form.Label>Name</Form.Label>
          <Form.Control
            value={name}
            placeholder={isTagged ? tag || "e.g. Food" : "Monthly budget"}
            onChange={(e) => setName(e.target.value)}
          />
        </Form.Group>
        <div className="d-grid gap-2">
          <Button type="submit" size="lg">
            Save
          </Button>
          {existing && (
            <Button variant="outline-danger" onClick={remove}>
              Delete
            </Button>
          )}
        </div>
      </Form>
    </Sheet>
  );
}

const BudgetPage = () => {
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Editing>(null);
  const { data: monthly } = useAsync(getMonthlyBudget, [version]);
  const { data: spent } = useAsync(() => getCurrentMonthExpensesSum(), [version]);
  const { data: tagged } = useAsync(() => getTaggedBudgetStats(), [version]);
  const onSaved = useCallback(() => setVersion((v) => v + 1), []);
  const onClose = useCallback(() => setEditing(null), []);

  return (
    <Page title="Budgets">
      <div className="section-title mt-0">This month</div>
      <div className="list">
        {monthly ? (
          <BudgetProgress
            name={monthly.name}
            sub="All expenses"
            value={monthly.value}
            spent={-(spent ?? 0)}
            onClick={() => setEditing({ kind: "monthly" })}
          />
        ) : (
          <button className="row-item" onClick={() => setEditing({ kind: "monthly" })}>
            <div className="row-main">
              <div className="row-title text-primary">Set a monthly budget</div>
              <div className="row-sub">Track total spending each month</div>
            </div>
          </button>
        )}
      </div>

      <div className="section-title">By tag</div>
      {tagged?.length === 0 && (
        <div className="list">
          <div className="empty-state">No tag budgets. Tap + to limit spending on a tag.</div>
        </div>
      )}
      {tagged && tagged.length > 0 && (
        <div className="list">
          {tagged.map((b) => (
            <BudgetProgress
              key={b.id}
              name={b.name}
              sub={`#${b.tag}`}
              value={b.value}
              spent={-b.totalPrice}
              onClick={() => setEditing({ kind: "tagged", budget: b })}
            />
          ))}
        </div>
      )}
      <Fab label="Add tag budget" onClick={() => setEditing({ kind: "tagged" })} />
      <BudgetSheet editing={editing} hasMonthly={!!monthly} onClose={onClose} onSaved={onSaved} />
    </Page>
  );
};

export default BudgetPage;
