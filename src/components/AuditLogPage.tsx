import { IonItem, IonLabel, IonList } from "@ionic/react";
import { useDataVersion } from "../api";
import { AuditEntry, describeEntry, listAuditLog } from "../api/audit";
import { formatDay } from "../format";
import { Page } from "./ui/Page";
import { LoadMore, usePagedList } from "./ui/usePagedList";

function EntryRow({ e }: { e: AuditEntry }) {
  const { title, summary, changes } = describeEntry(e);
  return (
    <IonItem>
      <IonLabel className="ion-text-wrap">
        <h2 className="row-title">{title}</h2>
        {summary && <p>{summary}</p>}
        {changes.map((c) => (
          <p key={c}>{c}</p>
        ))}
      </IonLabel>
      <div slot="end" className="log-time">
        {formatDay(e.at)}
        <br />
        {e.at.slice(11, 16)}
      </div>
    </IonItem>
  );
}

/** Every change made to the data, newest first. */
export function AuditLogPage() {
  const version = useDataVersion();
  const list = usePagedList(listAuditLog, version);
  return (
    <Page title="Activity log" back="/settings">
      {list.items?.length === 0 && <div className="empty-state">No changes recorded yet.</div>}
      {list.items && list.items.length > 0 && (
        <IonList className="list">
          {list.items.map((e) => (
            <EntryRow key={e.id} e={e} />
          ))}
        </IonList>
      )}
      <LoadMore list={list} />
    </Page>
  );
}
