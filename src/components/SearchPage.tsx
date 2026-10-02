import { IonButton, IonInput, IonList, IonSearchbar } from "@ionic/react";
import { useCallback, useMemo, useState } from "react";
import { useDataVersion } from "../api";
import { listExpenses, ExpenseFilters } from "../api/transactions";
import { parseDate } from "../dates";
import { parseAmount } from "../format";
import { Page } from "./ui/Page";
import { TagPicker } from "./ui/TagPicker";
import { AccountChips, useAccounts } from "./ui/accounts";
import { TransactionRow } from "./ui/TransactionRow";
import { useDebounced } from "./ui/useDebounced";
import { LoadMore, usePagedList } from "./ui/usePagedList";
import { SheetState, TransactionSheet } from "./TransactionSheet";

type Draft = {
  name: string;
  min: string;
  max: string;
  tags: string[];
  accountIds: number[];
  from: string;
  to: string;
};
const EMPTY: Draft = { name: "", min: "", max: "", tags: [], accountIds: [], from: "", to: "" };

function toFilters(d: Draft): ExpenseFilters {
  const min = parseAmount(d.min);
  const max = parseAmount(d.max);
  return {
    name: d.name.trim() || undefined,
    minAmount: isNaN(min) ? undefined : min,
    maxAmount: isNaN(max) ? undefined : max,
    tags: d.tags.length ? d.tags : undefined,
    accountIds: d.accountIds.length ? d.accountIds : undefined,
    startDate: d.from ? parseDate(d.from) : undefined,
    endDate: d.to ? parseDate(d.to) : undefined,
  };
}

export function SearchPage() {
  const version = useDataVersion();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [sheet, setSheet] = useState<SheetState>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const accounts = useAccounts();
  const toggleAccount = (id: number) =>
    set({ accountIds: draft.accountIds.includes(id) ? draft.accountIds.filter((a) => a !== id) : [...draft.accountIds, id] });

  const debounced = useDebounced(draft, 250);
  const key = JSON.stringify(debounced);
  const filters = useMemo(() => toFilters(debounced), [key]);
  const isEmpty = key === JSON.stringify(EMPTY);
  const fetchPage = useCallback(
    (page: { limit: number; offset: number }) => listExpenses({ ...filters, ...page }),
    [filters]
  );
  const list = usePagedList(fetchPage, `${key}:${version}`);
  const { items } = list;
  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <Page title="Search" back="/expenses">
      <div className="surface ion-padding form-fields">
        <IonSearchbar
          className="ion-no-padding"
          placeholder="Search by name"
          enterkeyhint="search"
          value={draft.name}
          onIonInput={(e) => set({ name: e.detail.value ?? "" })}
        />
        <div className="field-row">
          <IonInput
            fill="outline"
            label="Min amount"
            labelPlacement="floating"
            inputmode="decimal"
            value={draft.min}
            onIonInput={(e) => set({ min: e.detail.value ?? "" })}
          />
          <IonInput
            fill="outline"
            label="Max amount"
            labelPlacement="floating"
            inputmode="decimal"
            value={draft.max}
            onIonInput={(e) => set({ max: e.detail.value ?? "" })}
          />
        </div>
        <div className="field-row">
          <IonInput
            fill="outline"
            label="From"
            labelPlacement="stacked"
            type="date"
            value={draft.from}
            onIonInput={(e) => set({ from: e.detail.value ?? "" })}
          />
          <IonInput
            fill="outline"
            label="To"
            labelPlacement="stacked"
            type="date"
            value={draft.to}
            onIonInput={(e) => set({ to: e.detail.value ?? "" })}
          />
        </div>
        <div>
          <div className="field-label">Any of these tags</div>
          <TagPicker value={draft.tags} onChange={(tags) => set({ tags })} />
        </div>
        {accounts && accounts.length > 1 && (
          <div>
            <div className="field-label">Any of these accounts</div>
            <AccountChips
              accounts={accounts}
              isSelected={(id) => draft.accountIds.includes(id)}
              onToggle={toggleAccount}
            />
          </div>
        )}
        {!isEmpty && (
          <IonButton fill="clear" className="ion-no-margin align-start" onClick={() => setDraft(EMPTY)}>
            Clear filters
          </IonButton>
        )}
      </div>

      <div className="section-title">{isEmpty ? "All expenses" : "Results"}</div>
      {items?.length === 0 && <div className="empty-state">No matching expenses.</div>}
      {items && items.length > 0 && (
        <IonList className="list">
          {items.map((t) => (
            <TransactionRow
              key={t.id}
              t={t}
              showDate
              onClick={() => setSheet({ kind: "expense", transaction: t })}
            />
          ))}
        </IonList>
      )}
      <LoadMore list={list} />
      <TransactionSheet state={sheet} onClose={closeSheet} />
    </Page>
  );
}
