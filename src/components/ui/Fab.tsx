import { Plus } from "react-bootstrap-icons";

export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="fab" aria-label={label} onClick={onClick}>
      <Plus size={32} />
    </button>
  );
}
