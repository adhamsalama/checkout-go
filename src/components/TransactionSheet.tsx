import { IonButton, IonInput, IonTextarea } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import { notifyChanged } from "../api";
import {
  createExpense,
  createPayment,
  deleteTransaction,
  updateExpense,
  updatePayment,
} from "../api/transactions";
import { toDateInput } from "../dates";
import { parseAmount } from "../format";
import { Expense } from "../types";
import { useDialogs } from "./ui/dialogs";
import { Sheet, useLastValue } from "./ui/Sheet";
import { TagPicker, TagPickerHandle } from "./ui/TagPicker";

export type SheetState = { kind: "expense" | "payment"; transaction?: Expense } | null;

/** Add/edit/delete sheet for expenses and payments. Calls notifyChanged after any change. */
export function TransactionSheet({ state, onClose }: { state: SheetState; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [seller, setSeller] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const amountInput = useRef<HTMLIonInputElement>(null);
  const tagPicker = useRef<TagPickerHandle>(null);
  const dialogs = useDialogs();

  const shown = useLastValue(state);
  const editing = shown?.transaction;
  const isExpense = shown?.kind === "expense";

  useEffect(() => {
    if (!state) return;
    const t = state.transaction;
    setAmount(t ? String(Math.abs(t.price)) : "");
    setName(t?.name ?? "");
    setDate(toDateInput(t?.date ?? new Date()));
    setTags(t?.tags ?? []);
    setSeller(t?.sellerName ?? "");
    setNote(t?.comment ?? "");
  }, [state]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!(value > 0)) return dialogs.showError(new Error("Enter an amount greater than 0"));
    // Keep the original time of day if the date wasn't changed.
    const keepDate = editing && toDateInput(editing.date) === date;
    const fields = {
      name: name.trim(),
      sellerName: seller.trim(),
      comment: note.trim(),
      tags: isExpense ? (tagPicker.current?.pendingValue() ?? tags) : tags,
      date: keepDate ? editing.date : date || undefined,
    };
    setSaving(true);
    try {
      if (isExpense) {
        if (editing) await updateExpense(editing.id, { ...fields, price: -value });
        else await createExpense({ ...fields, price: value });
      } else {
        if (editing) await updatePayment(editing.id, { ...fields, price: value });
        else await createPayment({ ...fields, price: value });
      }
      notifyChanged();
      onClose();
    } catch (err) {
      dialogs.showError(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || !(await dialogs.confirmDelete(`Delete "${editing.name || "Untitled"}"?`))) return;
    try {
      await deleteTransaction(editing.id);
      notifyChanged();
      onClose();
    } catch (err) {
      dialogs.showError(err);
    }
  };

  const noun = isExpense ? "expense" : "payment";
  return (
    <Sheet
      show={state !== null}
      onClose={onClose}
      onDidPresent={() => !editing && amountInput.current?.setFocus()}
      title={editing ? `Edit ${noun}` : `New ${noun}`}
    >
      <form onSubmit={save}>
        <IonInput
          ref={amountInput}
          className="amount-input"
          aria-label="Amount"
          placeholder="0.00"
          inputmode="decimal"
          value={amount}
          onIonInput={(e) => setAmount(e.detail.value ?? "")}
        />
        <div className="form-fields">
          <IonInput
            fill="outline"
            label="Name"
            labelPlacement="floating"
            value={name}
            enterkeyhint="next"
            placeholder={isExpense ? "e.g. Groceries" : "e.g. Salary"}
            onIonInput={(e) => setName(e.detail.value ?? "")}
          />
          <IonInput
            fill="outline"
            label="Date"
            labelPlacement="stacked"
            type="date"
            value={date}
            onIonInput={(e) => setDate(e.detail.value ?? "")}
          />
          {isExpense && (
            <>
              <div>
                <div className="field-label">Tags</div>
                <TagPicker ref={tagPicker} value={tags} onChange={setTags} />
              </div>
              <IonInput
                fill="outline"
                label="Seller"
                labelPlacement="floating"
                value={seller}
                onIonInput={(e) => setSeller(e.detail.value ?? "")}
              />
            </>
          )}
          <IonTextarea
            fill="outline"
            label="Note"
            labelPlacement="floating"
            autoGrow
            rows={2}
            value={note}
            onIonInput={(e) => setNote(e.detail.value ?? "")}
          />
        </div>
        <div className="form-actions">
          <IonButton type="submit" expand="block" size="large" disabled={saving}>
            Save
          </IonButton>
          {editing && (
            <IonButton expand="block" fill="outline" color="danger" onClick={remove}>
              Delete
            </IonButton>
          )}
        </div>
      </form>
    </Sheet>
  );
}
