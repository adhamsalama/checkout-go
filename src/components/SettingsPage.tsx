import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSelect,
  IonSelectOption,
} from "@ionic/react";
import { useRef, useState } from "react";
import { Page } from "./ui/Page";
import { Capacitor } from "@capacitor/core";
import { notifyChanged, useAsync, useDataVersion } from "../api";
import { Backup, counts, exportBackup, ImportSummary, parseBackup, restoreBackup } from "../api/backup";
import { LegacyDatabase, openLegacyDatabase } from "../api/legacy";
import { useDialogs } from "./ui/dialogs";

function describe(c: ImportSummary) {
  return `${c.transactions} transactions, ${c.monthlyBudgets} monthly budgets, ${c.taggedBudgets} tagged budgets`;
}

async function saveBackupFile(backup: Backup) {
  const filename = `checkout-backup-${backup.exportedAt.slice(0, 10)}.json`;
  const json = JSON.stringify(backup, null, 2);
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: filename, files: [uri] });
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/** A button that opens the system file picker. */
function FilePicker({ label, disabled, onFile }: {
  label: string;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <IonButton fill="outline" disabled={disabled} onClick={() => input.current?.click()}>
        {label}
      </IonButton>
    </>
  );
}

export default function SettingsPage() {
  const version = useDataVersion();
  const dialogs = useDialogs();
  const { data: current } = useAsync(counts, [version]);
  const [legacy, setLegacy] = useState<LegacyDatabase | null>(null);
  const [legacyUser, setLegacyUser] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const restore = async (backup: Backup) => {
    const incoming = {
      transactions: backup.transactions.length,
      monthlyBudgets: backup.monthlyBudgets.length,
      taggedBudgets: backup.taggedBudgets.length,
    };
    const hasData = current && current.transactions + current.monthlyBudgets + current.taggedBudgets > 0;
    const ok = await dialogs.confirm(
      "Import data?",
      `Import ${describe(incoming)}?` +
        (hasData ? ` This REPLACES everything currently in the app (${describe(current)}).` : ""),
      "Import"
    );
    if (!ok) return;
    const summary = await restoreBackup(backup);
    notifyChanged();
    dialogs.toast(`Imported ${describe(summary)}.`);
  };

  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      dialogs.showError(err);
    } finally {
      setBusy(false);
    }
  };

  const onLegacyFile = (file: File) =>
    run(async () => {
      legacy?.close();
      const db = await openLegacyDatabase(new Uint8Array(await file.arrayBuffer()));
      if (db.users.length === 0) {
        db.close();
        throw new Error("The database has no data to import");
      }
      setLegacy(db);
      setLegacyUser(db.users[0].userId);
    })();

  const onBackupFile = (file: File) =>
    run(async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("Not a Checkout backup file");
      }
      await restore(parseBackup(parsed));
    })();

  const importLegacy = run(async () => {
    if (!legacy || legacyUser === null) return;
    await restore(legacy.toBackup(legacyUser));
    legacy.close();
    setLegacy(null);
  });

  return (
    <Page title="Backup">
      <p className="intro">All data is stored only on this device. {current && `Currently: ${describe(current)}.`}</p>

      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Export</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <p>Save all data as a JSON file you can import later or on another device.</p>
          <IonButton disabled={busy} onClick={run(async () => saveBackupFile(await exportBackup()))}>
            Export backup
          </IonButton>
        </IonCardContent>
      </IonCard>

      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Import backup</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <p>Restore a JSON file made with Export. This replaces all current data.</p>
          <FilePicker label="Choose file" disabled={busy} onFile={onBackupFile} />
        </IonCardContent>
      </IonCard>

      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Import from the old server</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <p>
            Pick the <code>sqlite3.db</code> file from the old Checkout Go backend. It is read, not
            modified. This replaces all current data.
          </p>
          <FilePicker label="Choose sqlite3.db" disabled={busy} onFile={onLegacyFile} />
          {legacy && (
            <div className="legacy-import">
              {legacy.users.length === 1 && <p>Found {legacy.users[0].transactions} transactions.</p>}
              {legacy.users.length > 1 && (
                <IonSelect
                  fill="outline"
                  label="Which user's data?"
                  labelPlacement="floating"
                  interface="action-sheet"
                  value={legacyUser}
                  onIonChange={(e) => setLegacyUser(Number(e.detail.value))}
                >
                  {legacy.users.map((u) => (
                    <IonSelectOption key={u.userId} value={u.userId}>
                      {u.username ?? `User ${u.userId}`} ({u.transactions} transactions)
                    </IonSelectOption>
                  ))}
                </IonSelect>
              )}
              <IonButton disabled={busy} onClick={importLegacy}>
                Import
              </IonButton>
            </div>
          )}
        </IonCardContent>
      </IonCard>
    </Page>
  );
}
