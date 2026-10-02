import { IonButton, IonInput, IonItem, IonLabel, IonTextarea } from "@ionic/react";
import { useEffect, useState } from "react";
import { notifyChanged } from "../api";
import { createTransfer, reverseTransfer } from "../api/transfers";
import { toDateInput } from "../dates";
import { formatDay, formatMoney, parseAmount } from "../format";
import { Transfer } from "../types";
import { AccountChips, useAccounts } from "./ui/accounts";
import { useDialogs } from "./ui/dialogs";
import { Sheet } from "./ui/Sheet";

/** Sheet for moving money between two active accounts. Calls notifyChanged after a transfer. */
export function TransferSheet({ show, onClose }: { show: boolean; onClose: () => void }) {
  const dialogs = useDialogs();
  const active = useAccounts()?.filter((a) => !a.archived) ?? [];
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setFrom(null);
    setTo(null);
    setAmount("");
    setDate(toDateInput(new Date()));
    setNote("");
  }, [show]);

  // Until picked: from the default account, to the first other one.
  const fromId = from ?? active.find((a) => a.isDefault)?.id ?? active[0]?.id ?? null;
  const toId = to ?? active.find((a) => a.id !== fromId)?.id ?? null;

  const pickFrom = (id: number) => {
    setFrom(id);
    if (id === toId) setTo(fromId);
  };
  const pickTo = (id: number) => {
    setTo(id);
    if (id === fromId) setFrom(toId);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromId === null || toId === null) return;
    const value = parseAmount(amount);
    if (!(value > 0)) return dialogs.showError(new Error("Enter an amount greater than 0"));
    const names = (id: number) => active.find((a) => a.id === id)?.name ?? "";
    const ok = await dialogs.confirm(
      "Transfer money?",
      `Move ${formatMoney(value)} from ${names(fromId)} to ${names(toId)}. Transfers can't be edited or deleted, only reversed.`,
      "Transfer"
    );
    if (!ok) return;
    setSaving(true);
    try {
      // Keep today's time of day, so same-day transfers stay in order.
      const today = toDateInput(new Date());
      await createTransfer({ fromAccountId: fromId, toAccountId: toId, amount: value, date: date === today ? undefined : date, note });
      notifyChanged();
      onClose();
    } catch (err) {
      dialogs.showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet show={show} onClose={onClose} title="Transfer money">
      <form onSubmit={save}>
        <IonInput
          className="amount-input"
          aria-label="Amount"
          placeholder="0.00"
          inputmode="decimal"
          value={amount}
          onIonInput={(e) => setAmount(e.detail.value ?? "")}
        />
        <div className="form-fields">
          <div>
            <div className="field-label">From</div>
            <AccountChips accounts={active} isSelected={(id) => id === fromId} onToggle={pickFrom} />
          </div>
          <div>
            <div className="field-label">To</div>
            <AccountChips accounts={active} isSelected={(id) => id === toId} onToggle={pickTo} />
          </div>
          <IonInput
            fill="outline"
            label="Date"
            labelPlacement="stacked"
            type="date"
            value={date}
            onIonInput={(e) => setDate(e.detail.value ?? "")}
          />
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
            Transfer
          </IonButton>
        </div>
      </form>
    </Sheet>
  );
}

/** A list row for a transfer; tapping one that can still be reversed offers to reverse it. */
export function TransferRow({ t }: { t: Transfer }) {
  const dialogs = useDialogs();
  const canReverse = t.reversedBy === null;
  const status = t.reversalOf !== null ? "Reversal" : t.reversedBy !== null ? "Reversed" : "";
  const details = [formatDay(t.date), status, t.note].filter(Boolean).join(" · ");

  const reverse = async () => {
    const ok = await dialogs.confirm(
      "Reverse transfer?",
      `Move ${formatMoney(t.amount)} back from ${t.toName} to ${t.fromName}. Both transfers stay in the history.`,
      "Reverse"
    );
    if (!ok) return;
    try {
      await reverseTransfer(t.id);
      notifyChanged();
    } catch (err) {
      dialogs.showError(err);
    }
  };

  return (
    <IonItem button={canReverse} detail={false} onClick={canReverse ? reverse : undefined}>
      <IonLabel>
        <h2 className="row-title">
          {t.fromName} → {t.toName}
        </h2>
        <p>{details}</p>
      </IonLabel>
      <div slot="end" className="amount">
        {formatMoney(t.amount)}
      </div>
    </IonItem>
  );
}
