import { IonInput } from "@ionic/react";
import { useState } from "react";
import { useAsync, useDataVersion } from "../../api";
import { listSellerCounts } from "../../api/sellers";

const MAX_SUGGESTIONS = 5;

/** The known sellers containing `text`, prefix matches first, then by use. */
export function matchSellers(sellers: string[], text: string): string[] {
  const q = text.trim().toLocaleLowerCase();
  if (!q) return [];
  const hits = sellers.filter((s) => s.toLocaleLowerCase().includes(q) && s.trim() !== text.trim());
  const prefix = hits.filter((s) => s.toLocaleLowerCase().startsWith(q));
  return [...prefix, ...hits.filter((s) => !prefix.includes(s))].slice(0, MAX_SUGGESTIONS);
}

/** A seller field that suggests existing sellers matching what's typed. */
export function SellerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const version = useDataVersion();
  const { data: known } = useAsync(listSellerCounts, [version]);
  const [focused, setFocused] = useState(false);
  const suggestions = focused ? matchSellers((known ?? []).map((s) => s.name), value) : [];
  return (
    <div>
      <IonInput
        fill="outline"
        label="Seller"
        labelPlacement="floating"
        autocomplete="off"
        value={value}
        onIonInput={(e) => onChange(e.detail.value ?? "")}
        onIonFocus={() => setFocused(true)}
        onIonBlur={() => setFocused(false)}
      />
      {suggestions.length > 0 && (
        <div className="suggestions" role="listbox" aria-label="Matching sellers">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={false}
              className="suggestion"
              // Keeps focus in the field so the list doesn't unmount before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s);
                setFocused(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
