import { IonButton, IonInput, IonItem, IonLabel, IonList, IonProgressBar } from "@ionic/react";
import { useCallback, useEffect, useState } from "react";
import { notifyChanged, useAsync, useDataVersion } from "../api";
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
import { budgetColor } from "./ListExpenses";
import { useDialogs } from "./ui/dialogs";
import { Fab } from "./ui/Fab";
import { Page } from "./ui/Page";
import { Sheet, useLastValue } from "./ui/Sheet";
import { TagChips } from "./ui/TagPicker";

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
    <IonItem button detail={false} onClick={onClick}>
      <div className="budget-row">
        <div className="budget-head">
          <IonLabel>
            <h2 className="row-title">{name}</h2>
            {sub && <p>{sub}</p>}
          </IonLabel>
          <div className="ion-text-end">
            <div className="amount">{formatMoney(spent)}</div>
            <div className="row-sub">of {formatMoney(value)}</div>
          </div>
        </div>
        <IonProgressBar
          className="budget-bar"
          color={budgetColor(percentLeft)}
          value={Math.min(1, spent / value)}
        />
        <div className={`row-sub ${remaining < 0 ? "danger" : ""}`}>
          {remaining >= 0 ? `${formatMoney(remaining)} left` : `${formatMoney(-remaining)} over`}
        </div>
      </div>
    </IonItem>
  );
}

type Editing =
  | { kind: "monthly" }
  | { kind: "tagged"; budget?: TaggedBudgetStats }
  | null;

function BudgetSheet({ editing, hasMonthly, onClose }: {
  editing: Editing;
  hasMonthly: boolean;
  onClose: () => void;
}) {
  const version = useDataVersion();
  const dialogs = useDialogs();
  const { data: knownTags } = useAsync(getAllTags, [version]);
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

  const shown = useLastValue(editing);
  const isTagged = shown?.kind === "tagged";
  const existing = shown?.kind === "tagged" ? shown.budget : hasMonthly;

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
      notifyChanged();
      onClose();
    } catch (err) {
      dialogs.showError(err);
    }
  };

  const remove = async () => {
    if (!(await dialogs.confirmDelete("Delete this budget?"))) return;
    try {
      if (editing?.kind === "monthly") await deleteMonthlyBudget();
      else if (editing?.kind === "tagged" && editing.budget) await deleteTaggedBudget(editing.budget.id);
      notifyChanged();
      onClose();
    } catch (err) {
      dialogs.showError(err);
    }
  };

  const title = isTagged ? (existing ? "Edit tag budget" : "New tag budget") : "Monthly budget";
  return (
    <Sheet show={editing !== null} onClose={onClose} title={title}>
      <form onSubmit={save}>
        <IonInput
          className="amount-input"
          aria-label="Budget amount"
          placeholder="0.00"
          inputmode="decimal"
          value={value}
          onIonInput={(e) => setValue(e.detail.value ?? "")}
        />
        <div className="form-fields">
          {isTagged && (
            <div>
              <div className="field-label">Tag</div>
              <TagChips tags={knownTags ?? []} isSelected={(t) => t === tag} onToggle={setTag} />
              <IonInput
                fill="outline"
                label="Tag"
                labelPlacement="floating"
                helperText="Counts this month's expenses with this tag."
                value={tag}
                onIonInput={(e) => setTag(e.detail.value ?? "")}
              />
            </div>
          )}
          <IonInput
            fill="outline"
            label="Name"
            labelPlacement="floating"
            value={name}
            placeholder={isTagged ? tag || "e.g. Food" : "Monthly budget"}
            onIonInput={(e) => setName(e.detail.value ?? "")}
          />
        </div>
        <div className="form-actions">
          <IonButton type="submit" expand="block" size="large">
            Save
          </IonButton>
          {existing && (
            <IonButton expand="block" fill="outline" color="danger" onClick={remove}>
              Delete
            </IonButton>
          )}
        </div>
      </form>
    </Sheet>
  );
}

const BudgetPage = () => {
  const version = useDataVersion();
  const [editing, setEditing] = useState<Editing>(null);
  const { data: monthly } = useAsync(getMonthlyBudget, [version]);
  const { data: spent } = useAsync(() => getCurrentMonthExpensesSum(), [version]);
  const { data: tagged } = useAsync(() => getTaggedBudgetStats(), [version]);
  const onClose = useCallback(() => setEditing(null), []);

  return (
    <Page title="Budgets" fab={<Fab label="Add tag budget" onClick={() => setEditing({ kind: "tagged" })} />}>
      <div className="section-title">This month</div>
      <IonList className="list">
        {monthly ? (
          <BudgetProgress
            name={monthly.name}
            sub="All expenses"
            value={monthly.value}
            spent={-(spent ?? 0)}
            onClick={() => setEditing({ kind: "monthly" })}
          />
        ) : (
          <IonItem button detail={false} onClick={() => setEditing({ kind: "monthly" })}>
            <IonLabel>
              <h2 className="row-title primary">Set a monthly budget</h2>
              <p>Track total spending each month</p>
            </IonLabel>
          </IonItem>
        )}
      </IonList>

      <div className="section-title">By tag</div>
      {tagged?.length === 0 && (
        <div className="list">
          <div className="empty-state">No tag budgets. Tap + to limit spending on a tag.</div>
        </div>
      )}
      {tagged && tagged.length > 0 && (
        <IonList className="list">
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
        </IonList>
      )}
      <BudgetSheet editing={editing} hasMonthly={!!monthly} onClose={onClose} />
    </Page>
  );
};

export default BudgetPage;
