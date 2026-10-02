import { IonBadge, IonButton, IonInput, IonItem, IonLabel, IonList, IonToggle } from "@ionic/react";
import { useCallback, useEffect, useState } from "react";
import { notifyChanged, useDataVersion } from "../api";
import { createAccount, deleteAccount, setDefaultAccount, updateAccount } from "../api/accounts";
import { listTransfers } from "../api/transfers";
import { formatMoney, parseAmount } from "../format";
import { Account } from "../types";
import { useAccounts } from "./ui/accounts";
import { useDialogs } from "./ui/dialogs";
import { Fab } from "./ui/Fab";
import { Page } from "./ui/Page";
import { Sheet, useLastValue } from "./ui/Sheet";
import { LoadMore, usePagedList } from "./ui/usePagedList";
import { TransferRow, TransferSheet } from "./TransferSheet";

type Editing = { account?: Account } | null;

function AccountRow({ account, onClick }: { account: Account; onClick: () => void }) {
  return (
    <IonItem button detail={false} onClick={onClick}>
      <IonLabel>
        <h2 className="row-title">
          {account.name}
          {account.isDefault && (
            <IonBadge color="primary" className="default-badge">
              Default
            </IonBadge>
          )}
        </h2>
        {account.openingBalance !== 0 && <p>Opening balance {formatMoney(account.openingBalance)}</p>}
      </IonLabel>
      <div slot="end" className={`amount ${account.balance < 0 ? "expense" : ""}`}>
        {formatMoney(account.balance)}
      </div>
    </IonItem>
  );
}

function AccountSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const dialogs = useDialogs();
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const shown = useLastValue(editing);
  const account = shown?.account;

  useEffect(() => {
    if (!editing) return;
    setName(editing.account?.name ?? "");
    setOpening(editing.account ? String(editing.account.openingBalance) : "");
    setIsDefault(editing.account?.isDefault ?? false);
  }, [editing]);

  const run = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await fn();
      notifyChanged();
      onClose();
    } catch (err) {
      dialogs.showError(err);
    } finally {
      setSaving(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const openingBalance = opening.trim() === "" ? 0 : parseAmount(opening);
    run(async () => {
      const input = { name, openingBalance };
      const saved = account ? await updateAccount(account.id, input) : await createAccount(input);
      if (isDefault && !saved.isDefault) await setDefaultAccount(saved.id);
    });
  };

  const toggleArchived = () => run(() => updateAccount(account!.id, { archived: !account!.archived }));

  const remove = async () => {
    if (!account || !(await dialogs.confirmDelete(`Delete "${account.name}"?`))) return;
    run(() => deleteAccount(account.id));
  };

  return (
    <Sheet show={editing !== null} onClose={onClose} title={account ? "Edit account" : "New account"}>
      <form onSubmit={save}>
        <div className="form-fields">
          <IonInput
            fill="outline"
            label="Name"
            labelPlacement="floating"
            placeholder="e.g. Cash"
            value={name}
            onIonInput={(e) => setName(e.detail.value ?? "")}
          />
          <IonInput
            fill="outline"
            label="Opening balance"
            labelPlacement="floating"
            inputmode="decimal"
            placeholder="0.00"
            helperText="What the account held before the first transaction you recorded."
            value={opening}
            onIonInput={(e) => setOpening(e.detail.value ?? "")}
          />
          {!account?.archived && (
            <IonToggle
              checked={isDefault}
              // The default is changed by making another account the default.
              disabled={account?.isDefault}
              onIonChange={(e) => setIsDefault(e.detail.checked)}
            >
              Default account
            </IonToggle>
          )}
        </div>
        <div className="form-actions">
          <IonButton type="submit" expand="block" size="large" disabled={saving}>
            Save
          </IonButton>
          {account && !account.isDefault && (
            <>
              <IonButton expand="block" fill="outline" disabled={saving} onClick={toggleArchived}>
                {account.archived ? "Unarchive" : "Archive"}
              </IonButton>
              <IonButton expand="block" fill="outline" color="danger" disabled={saving} onClick={remove}>
                Delete
              </IonButton>
            </>
          )}
        </div>
      </form>
    </Sheet>
  );
}

export function AccountsPage() {
  const accounts = useAccounts();
  const version = useDataVersion();
  const transfers = usePagedList(listTransfers, version);
  const [editing, setEditing] = useState<Editing>(null);
  const [transferring, setTransferring] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const onClose = useCallback(() => setEditing(null), []);
  const closeTransfer = useCallback(() => setTransferring(false), []);
  const active = accounts?.filter((a) => !a.archived) ?? [];
  const archived = accounts?.filter((a) => a.archived) ?? [];

  return (
    <Page title="Accounts" back="/expenses" fab={<Fab label="Add account" onClick={() => setEditing({})} />}>
      <p className="intro">New expenses and payments go to the default account unless you pick another.</p>
      <IonList className="list section-gap">
        {active.map((a) => (
          <AccountRow key={a.id} account={a} onClick={() => setEditing({ account: a })} />
        ))}
      </IonList>
      {active.length > 1 && (
        <IonButton expand="block" fill="outline" className="section-gap" onClick={() => setTransferring(true)}>
          Transfer money
        </IonButton>
      )}
      {archived.length > 0 && (
        <>
          <IonButton fill="clear" className="ion-no-margin section-gap" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </IonButton>
          {showArchived && (
            <IonList className="list">
              {archived.map((a) => (
                <AccountRow key={a.id} account={a} onClick={() => setEditing({ account: a })} />
              ))}
            </IonList>
          )}
        </>
      )}
      {transfers.items && transfers.items.length > 0 && (
        <>
          <div className="section-title">Transfers</div>
          <IonList className="list">
            {transfers.items.map((t) => (
              <TransferRow key={t.id} t={t} />
            ))}
          </IonList>
        </>
      )}
      <LoadMore list={transfers} />
      <AccountSheet editing={editing} onClose={onClose} />
      <TransferSheet show={transferring} onClose={closeTransfer} />
    </Page>
  );
}
