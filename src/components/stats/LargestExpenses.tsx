import { IonButton, IonList } from "@ionic/react";
import { ReactNode, useCallback } from "react";
import { listLargestExpenses, StatsFilter } from "../../api/stats";
import { TransactionRow } from "../ui/TransactionRow";
import { usePagedList } from "../ui/usePagedList";
import { SheetState } from "../TransactionSheet";

const PAGE = 5;

/** The most expensive matching expenses, five at a time. `total` is how many match. */
export function LargestExpenses({
  title,
  filter,
  total,
  version,
  onOpen,
}: {
  title: ReactNode;
  filter: StatsFilter;
  total: number;
  version: number;
  onOpen: (sheet: SheetState) => void;
}) {
  const key = JSON.stringify(filter);
  const fetchPage = useCallback(
    (page: { limit: number; offset: number }) => listLargestExpenses(filter, page),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );
  const list = usePagedList(fetchPage, `${key}:${version}`, PAGE);
  const { items } = list;
  return (
    <>
      <div className="section-title">
        {title}
        <span>
          {total} {total === 1 ? "expense" : "expenses"}
        </span>
      </div>
      {items && items.length > 0 && (
        <IonList className="list">
          {items.map((t) => (
            <TransactionRow key={t.id} t={t} showDate onClick={() => onOpen({ kind: "expense", transaction: t })} />
          ))}
        </IonList>
      )}
      {items && items.length < total && !list.done && (
        <IonButton fill="clear" expand="block" onClick={list.loadMore}>
          Show next {Math.min(PAGE, total - items.length)}
        </IonButton>
      )}
    </>
  );
}
