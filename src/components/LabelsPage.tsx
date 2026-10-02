import { IonButton, IonInput, IonItem, IonLabel, IonList, IonSegment, IonSegmentButton } from "@ionic/react";
import { useCallback, useEffect, useState } from "react";
import { notifyChanged, useAsync, useDataVersion } from "../api";
import { listSellerCounts, renameSeller } from "../api/sellers";
import { listTagCounts, renameTag } from "../api/tags";
import { useDialogs } from "./ui/dialogs";
import { Page } from "./ui/Page";
import { Sheet, useLastValue } from "./ui/Sheet";

type Kind = "tags" | "sellers";
type Entry = { name: string; count: number };

const KINDS = {
  tags: { noun: "tag", list: listTagCounts, rename: renameTag, empty: "No tags yet. Add them to expenses." },
  sellers: {
    noun: "seller",
    list: listSellerCounts,
    rename: renameSeller,
    empty: "No sellers yet. Add them to expenses.",
  },
};

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

function RenameSheet({
  kind,
  editing,
  all,
  onClose,
}: {
  kind: Kind;
  editing: Entry | null;
  all: Entry[];
  onClose: () => void;
}) {
  const dialogs = useDialogs();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const shown = useLastValue(editing);
  const { noun, rename } = KINDS[kind];
  useEffect(() => {
    if (editing) setName(editing.name);
  }, [editing]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const to = name.trim();
    if (to !== editing.name && all.some((t) => t.name === to)) {
      const ok = await dialogs.confirm(
        `Merge ${noun}s?`,
        `"${to}" already exists. Expenses with ${noun} "${editing.name}" will get "${to}" instead.`,
        "Merge"
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const changed = await rename(editing.name, to);
      notifyChanged();
      onClose();
      if (changed) dialogs.toast(`Updated ${plural(changed, "transaction")}.`);
    } catch (err) {
      dialogs.showError(err);
    } finally {
      setSaving(false);
    }
  };

  const helper =
    shown &&
    `Renames it on ${plural(shown.count, "transaction")}${kind === "tags" ? " and any tag budget" : ""}.`;
  return (
    <Sheet show={editing !== null} onClose={onClose} title={`Rename ${noun}`}>
      <form onSubmit={save}>
        <IonInput
          fill="outline"
          label="Name"
          labelPlacement="floating"
          helperText={helper || undefined}
          value={name}
          onIonInput={(e) => setName(e.detail.value ?? "")}
        />
        <div className="form-actions">
          <IonButton type="submit" expand="block" size="large" disabled={saving}>
            Save
          </IonButton>
        </div>
      </form>
    </Sheet>
  );
}

/** Lists tags and sellers with their usage, and renames them everywhere. */
export function LabelsPage() {
  const version = useDataVersion();
  const [kind, setKind] = useState<Kind>("tags");
  const { data: entries } = useAsync(KINDS[kind].list, [kind, version]);
  const [editing, setEditing] = useState<Entry | null>(null);
  const onClose = useCallback(() => setEditing(null), []);

  return (
    <Page title="Tags & sellers" back="/expenses">
      <IonSegment value={kind} onIonChange={(e) => setKind(e.detail.value as Kind)}>
        <IonSegmentButton value="tags">
          <IonLabel>Tags</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="sellers">
          <IonLabel>Sellers</IonLabel>
        </IonSegmentButton>
      </IonSegment>
      {entries?.length === 0 && <div className="empty-state">{KINDS[kind].empty}</div>}
      {entries && entries.length > 0 && (
        <IonList className="list section-gap">
          {entries.map((t) => (
            <IonItem key={t.name} button detail={false} onClick={() => setEditing(t)}>
              <IonLabel>
                <h2 className="row-title">{t.name}</h2>
              </IonLabel>
              <div slot="end" className="row-sub">
                {plural(t.count, "transaction")}
              </div>
            </IonItem>
          ))}
        </IonList>
      )}
      <RenameSheet kind={kind} editing={editing} all={entries ?? []} onClose={onClose} />
    </Page>
  );
}
