import { IonChip } from "@ionic/react";
import { useAsync, useDataVersion } from "../../api";
import { listAccounts } from "../../api/accounts";
import { Account } from "../../types";

// Every row and picker asks for the accounts; share one query per data version.
let cache: { version: number; promise: Promise<Account[]> } | null = null;

function loadAccounts(version: number) {
  if (cache?.version !== version) {
    const promise = listAccounts({ includeArchived: true });
    cache = { version, promise };
    promise.catch(() => cache?.promise === promise && (cache = null));
  }
  return cache.promise;
}

/** All accounts, archived ones included (default first), or null while loading. */
export function useAccounts(): Account[] | null {
  const version = useDataVersion();
  return useAsync(() => loadAccounts(version), [version]).data;
}

/** Tappable chips for accounts. */
export function AccountChips({
  accounts,
  isSelected,
  onToggle,
}: {
  accounts: Account[];
  isSelected: (id: number) => boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <div className="chips">
      {accounts.map((a) => (
        <IonChip
          key={a.id}
          outline={!isSelected(a.id)}
          color={isSelected(a.id) ? "primary" : undefined}
          onClick={() => onToggle(a.id)}
        >
          {a.name}
        </IonChip>
      ))}
    </div>
  );
}
