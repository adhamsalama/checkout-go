import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { listExpenses, ExpenseFilters } from "../api/transactions";
import { parseDate } from "../dates";
import { parseAmount } from "../format";
import { Page } from "./ui/Page";
import { TagPicker } from "./ui/TagPicker";
import { TransactionRow } from "./ui/TransactionRow";
import { usePagedList } from "./ui/usePagedList";
import { SheetState, TransactionSheet } from "./TransactionSheet";

type Draft = { name: string; min: string; max: string; tags: string[]; from: string; to: string };
const EMPTY: Draft = { name: "", min: "", max: "", tags: [], from: "", to: "" };

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function toFilters(d: Draft): ExpenseFilters {
  const min = parseAmount(d.min);
  const max = parseAmount(d.max);
  return {
    name: d.name.trim() || undefined,
    minAmount: isNaN(min) ? undefined : min,
    maxAmount: isNaN(max) ? undefined : max,
    tags: d.tags.length ? d.tags : undefined,
    startDate: d.from ? parseDate(d.from) : undefined,
    endDate: d.to ? parseDate(d.to) : undefined,
  };
}

export function SearchPage() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [sheet, setSheet] = useState<SheetState>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const debounced = useDebounced(draft, 250);
  const key = JSON.stringify(debounced);
  const filters = useMemo(() => toFilters(debounced), [key]);
  const isEmpty = key === JSON.stringify(EMPTY);
  const fetchPage = useCallback(
    (page: { limit: number; offset: number }) => listExpenses({ ...filters, ...page }),
    [filters]
  );
  const { items, done, sentinel, reset } = usePagedList(fetchPage, key);
  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <Page title="Search" back>
      <div className="surface p-3">
        <Form.Control
          type="search"
          placeholder="Search by name"
          enterKeyHint="search"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <div className="d-flex gap-2 mt-2">
          <Form.Control
            aria-label="Minimum amount"
            placeholder="Min amount"
            inputMode="decimal"
            value={draft.min}
            onChange={(e) => set({ min: e.target.value })}
          />
          <Form.Control
            aria-label="Maximum amount"
            placeholder="Max amount"
            inputMode="decimal"
            value={draft.max}
            onChange={(e) => set({ max: e.target.value })}
          />
        </div>
        <div className="d-flex gap-2 mt-2">
          <Form.Group className="flex-fill">
            <Form.Label className="stat-label mb-1">From</Form.Label>
            <Form.Control type="date" value={draft.from} onChange={(e) => set({ from: e.target.value })} />
          </Form.Group>
          <Form.Group className="flex-fill">
            <Form.Label className="stat-label mb-1">To</Form.Label>
            <Form.Control type="date" value={draft.to} onChange={(e) => set({ to: e.target.value })} />
          </Form.Group>
        </div>
        <div className="mt-2">
          <div className="stat-label mb-1">Any of these tags</div>
          <TagPicker value={draft.tags} onChange={(tags) => set({ tags })} />
        </div>
        {!isEmpty && (
          <Button variant="link" className="px-0 mt-1" onClick={() => setDraft(EMPTY)}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="section-title">{isEmpty ? "All expenses" : "Results"}</div>
      {items?.length === 0 && <div className="empty-state">No matching expenses.</div>}
      {items && items.length > 0 && (
        <div className="list">
          {items.map((t) => (
            <TransactionRow
              key={t.id}
              t={t}
              showDate
              onClick={() => setSheet({ kind: "expense", transaction: t })}
            />
          ))}
        </div>
      )}
      {!done && <div ref={sentinel} className="empty-state">Loading…</div>}
      <TransactionSheet state={sheet} onClose={closeSheet} onSaved={reset} />
    </Page>
  );
}
