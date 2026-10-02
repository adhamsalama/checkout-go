import { useState } from "react";
import { Alert, Button, Card, Form } from "react-bootstrap";
import { Capacitor } from "@capacitor/core";
import { alertError, useAsync } from "../api";
import { Backup, counts, exportBackup, ImportSummary, parseBackup, restoreBackup } from "../api/backup";
import { LegacyDatabase, openLegacyDatabase } from "../api/legacy";

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

export default function SettingsPage() {
  const { data: current, reload } = useAsync(counts);
  const [legacy, setLegacy] = useState<LegacyDatabase | null>(null);
  const [legacyUser, setLegacyUser] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const restore = async (backup: Backup) => {
    const incoming = {
      transactions: backup.transactions.length,
      monthlyBudgets: backup.monthlyBudgets.length,
      taggedBudgets: backup.taggedBudgets.length,
    };
    const hasData = current && current.transactions + current.monthlyBudgets + current.taggedBudgets > 0;
    const prompt =
      `Import ${describe(incoming)}?` +
      (hasData ? `\n\nThis REPLACES everything currently in the app (${describe(current)}).` : "");
    if (!window.confirm(prompt)) return;
    const summary = await restoreBackup(backup);
    setMessage(`Imported ${describe(summary)}.`);
    reload();
  };

  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      alertError(err);
    } finally {
      setBusy(false);
    }
  };

  const onLegacyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
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
  };

  const onBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    run(async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("Not a Checkout backup file");
      }
      await restore(parseBackup(parsed));
    })();
  };

  const importLegacy = run(async () => {
    if (!legacy || legacyUser === null) return;
    await restore(legacy.toBackup(legacyUser));
    legacy.close();
    setLegacy(null);
  });

  return (
    <>
      <h1>Backup</h1>
      <p>All data is stored only on this device. {current && `Currently: ${describe(current)}.`}</p>
      {message && <Alert variant="success">{message}</Alert>}

      <Card className="mb-3">
        <Card.Body>
          <Card.Title>Export</Card.Title>
          <Card.Text>Save all data as a JSON file you can import later or on another device.</Card.Text>
          <Button disabled={busy} onClick={run(async () => saveBackupFile(await exportBackup()))}>
            Export backup
          </Button>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body>
          <Card.Title>Import backup</Card.Title>
          <Card.Text>Restore a JSON file made with Export. This replaces all current data.</Card.Text>
          <Form.Control type="file" disabled={busy} onChange={onBackupFile} />
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body>
          <Card.Title>Import from the old server</Card.Title>
          <Card.Text>
            Pick the <code>sqlite3.db</code> file from the old Checkout Go backend. It is read, not
            modified. This replaces all current data.
          </Card.Text>
          <Form.Control type="file" disabled={busy} onChange={onLegacyFile} />
          {legacy && (
            <div className="mt-3">
              {legacy.users.length === 1 && (
                <p>Found {legacy.users[0].transactions} transactions.</p>
              )}
              {legacy.users.length > 1 && (
                <Form.Group className="mb-2">
                  <Form.Label>Which user's data?</Form.Label>
                  <Form.Select
                    value={legacyUser ?? undefined}
                    onChange={(e) => setLegacyUser(Number(e.target.value))}
                  >
                    {legacy.users.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.username ?? `User ${u.userId}`} ({u.transactions} transactions)
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              )}
              <Button disabled={busy} onClick={importLegacy}>
                Import
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>
    </>
  );
}
