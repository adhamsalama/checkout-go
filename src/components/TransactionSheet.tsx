import { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { alertError } from "../api";
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
import { Sheet } from "./ui/Sheet";
import { TagPicker } from "./ui/TagPicker";

export type SheetState = { kind: "expense" | "payment"; transaction?: Expense } | null;

/** Add/edit/delete sheet for expenses and payments. Calls onSaved after any change. */
export function TransactionSheet({ state, onClose, onSaved }: {
  state: SheetState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [seller, setSeller] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const editing = state?.transaction;
  const isExpense = state?.kind === "expense";

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
    if (!(value > 0)) return alert("Enter an amount greater than 0");
    // Keep the original time of day if the date wasn't changed.
    const keepDate = editing && toDateInput(editing.date) === date;
    const fields = {
      name: name.trim(),
      sellerName: seller.trim(),
      comment: note.trim(),
      tags,
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
      onSaved();
      onClose();
    } catch (err) {
      alertError(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || !window.confirm(`Delete "${editing.name}"?`)) return;
    try {
      await deleteTransaction(editing.id);
      onSaved();
      onClose();
    } catch (err) {
      alertError(err);
    }
  };

  const noun = isExpense ? "expense" : "payment";
  return (
    <Sheet show={state !== null} onClose={onClose} title={editing ? `Edit ${noun}` : `New ${noun}`}>
      <Form onSubmit={save}>
        <Form.Control
          className="amount-input mb-2"
          aria-label="Amount"
          placeholder="0.00"
          inputMode="decimal"
          value={amount}
          autoFocus={!editing}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Form.Group className="mb-3">
          <Form.Label>Name</Form.Label>
          <Form.Control
            value={name}
            enterKeyHint="next"
            placeholder={isExpense ? "e.g. Groceries" : "e.g. Salary"}
            onChange={(e) => setName(e.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Date</Form.Label>
          <Form.Control type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Form.Group>
        {isExpense && (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Tags</Form.Label>
              <TagPicker value={tags} onChange={setTags} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Seller</Form.Label>
              <Form.Control value={seller} onChange={(e) => setSeller(e.target.value)} />
            </Form.Group>
          </>
        )}
        <Form.Group className="mb-3">
          <Form.Label>Note</Form.Label>
          <Form.Control as="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Form.Group>
        <div className="d-grid gap-2">
          <Button type="submit" size="lg" disabled={saving}>
            Save
          </Button>
          {editing && (
            <Button variant="outline-danger" onClick={remove}>
              Delete
            </Button>
          )}
        </div>
      </Form>
    </Sheet>
  );
}
