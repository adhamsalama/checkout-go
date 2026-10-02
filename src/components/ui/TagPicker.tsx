import { useState } from "react";
import Form from "react-bootstrap/Form";
import { useAsync } from "../../api";
import { getAllTags } from "../../api/transactions";

/** Tappable chips for existing tags plus a field for new ones. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const { data: known } = useAsync(getAllTags);
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
      {all.length > 0 && (
        <div className="mb-2">
          {all.map((tag) => (
            <button
              type="button"
              key={tag}
              className={`chip${value.includes(tag) ? " selected" : ""}`}
              onClick={() => toggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      <Form.Control
        placeholder="New tag"
        value={draft}
        enterKeyHint="done"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={addDraft}
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
