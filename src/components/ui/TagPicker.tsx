import { IonChip, IonInput } from "@ionic/react";
import { useState } from "react";
import { useAsync, useDataVersion } from "../../api";
import { getAllTags } from "../../api/transactions";

/** Tappable chips for existing tags. */
export function TagChips({ tags, isSelected, onToggle }: {
  tags: string[];
  isSelected: (tag: string) => boolean;
  onToggle: (tag: string) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="chips">
      {tags.map((tag) => (
        <IonChip
          key={tag}
          outline={!isSelected(tag)}
          color={isSelected(tag) ? "primary" : undefined}
          onClick={() => onToggle(tag)}
        >
          {tag}
        </IonChip>
      ))}
    </div>
  );
}

/** Tappable chips for existing tags plus a field for new ones. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const version = useDataVersion();
  const { data: known } = useAsync(getAllTags, [version]);
  const [draft, setDraft] = useState("");
  const all = [...new Set([...(known ?? []), ...value])];
  const toggle = (tag: string) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  const addDraft = () => {
    const tags = draft.split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length) onChange([...new Set([...value, ...tags])]);
    setDraft("");
  };
  return (
    <>
      <TagChips tags={all} isSelected={(t) => value.includes(t)} onToggle={toggle} />
      <IonInput
        fill="outline"
        label="New tag"
        labelPlacement="floating"
        value={draft}
        enterkeyhint="done"
        onIonInput={(e) => setDraft(e.detail.value ?? "")}
        onIonBlur={addDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addDraft();
          }
        }}
      />
    </>
  );
}
