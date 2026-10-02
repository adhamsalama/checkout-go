import { IonChip, IonInput } from "@ionic/react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
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

function splitTags(text: string): string[] {
  return text.split(",").map((t) => t.trim()).filter(Boolean);
}

export type TagPickerHandle = {
  /** The tags including any still typed in the new-tag field, for reading at submit time. */
  pendingValue(): string[];
};

/** Tappable chips for existing tags plus a field for new ones. */
export const TagPicker = forwardRef<
  TagPickerHandle,
  { value: string[]; onChange: (tags: string[]) => void }
>(function TagPicker({ value, onChange }, ref) {
  const version = useDataVersion();
  const input = useRef<HTMLIonInputElement>(null);
  const { data: known } = useAsync(getAllTags, [version]);
  const [draft, setDraft] = useState("");
  const all = [...new Set([...(known ?? []), ...value])];
  const toggle = (tag: string) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  // Takes the input's current text: ionInput state updates render at default priority, so `draft` can
  // still be stale when Enter or blur arrives right after typing.
  const addDraft = (text: string) => {
    const tags = splitTags(text);
    if (tags.length) onChange([...new Set([...value, ...tags])]);
    setDraft("");
  };
  // Tapping Save blurs the field, but that blur's state update hasn't rendered when the submit runs,
  // so the form reads the field's text directly instead of relying on `value` being up to date.
  useImperativeHandle(
    ref,
    () => ({ pendingValue: () => [...new Set([...value, ...splitTags(String(input.current?.value ?? ""))])] }),
    [value]
  );
  return (
    <>
      <TagChips tags={all} isSelected={(t) => value.includes(t)} onToggle={toggle} />
      {/* Enter adds the tag; preventDefault stops it from submitting the surrounding form. */}
      <div
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addDraft((e.target as HTMLInputElement).value);
          }
        }}
      >
        <IonInput
          ref={input}
          fill="outline"
          label="New tag"
          labelPlacement="floating"
          value={draft}
          enterkeyhint="done"
          onIonInput={(e) => setDraft(e.detail.value ?? "")}
          onIonBlur={(e) => addDraft(String(e.target.value ?? ""))}
        />
      </div>
    </>
  );
});
