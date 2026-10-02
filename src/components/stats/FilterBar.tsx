import { IonChip, IonIcon, IonLabel, IonSearchbar } from "@ionic/react";
import { add, closeCircle } from "ionicons/icons";
import { useState } from "react";
import { useAsync, useDataVersion } from "../../api";
import { getAllTags } from "../../api/transactions";
import { Sheet } from "../ui/Sheet";
import { TagChips } from "../ui/TagPicker";

/** Search box and required tags; both narrow everything on the Stats screen. */
export function FilterBar({
  query,
  onQuery,
  tags,
  onTags,
}: {
  query: string;
  onQuery: (q: string) => void;
  tags: string[];
  onTags: (tags: string[]) => void;
}) {
  const version = useDataVersion();
  const { data: known } = useAsync(getAllTags, [version]);
  const [picking, setPicking] = useState(false);
  const toggle = (tag: string) => onTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  return (
    <div className="filter-bar">
      <IonSearchbar
        className="ion-no-padding"
        placeholder="Search name, seller or comment"
        value={query}
        onIonInput={(e) => onQuery(e.detail.value ?? "")}
      />
      <div className="chips filter-chips">
        {tags.map((tag) => (
          <IonChip key={tag} color="primary" onClick={() => toggle(tag)}>
            {tag}
            <IonIcon icon={closeCircle} aria-label={`Remove ${tag}`} />
          </IonChip>
        ))}
        <IonChip outline onClick={() => setPicking(true)}>
          {/* A label, so the icon isn't also :last-child, whose Ionic margin pulls it onto the text. */}
          <IonIcon icon={add} />
          <IonLabel>Tag</IonLabel>
        </IonChip>
      </div>
      <Sheet show={picking} onClose={() => setPicking(false)} title="Filter by tags">
        <p className="row-sub">Only expenses with every selected tag.</p>
        <TagChips tags={known ?? []} isSelected={(t) => tags.includes(t)} onToggle={toggle} />
      </Sheet>
    </div>
  );
}
