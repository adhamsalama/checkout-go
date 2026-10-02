import { IonButton, IonIcon, IonInput, IonLabel, IonSegment, IonSegmentButton } from "@ionic/react";
import { chevronBack, chevronForward } from "ionicons/icons";
import { useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Preset, RangeState, resolveRange, stepRange } from "./range";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "3m", label: "3M" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
];

/** Preset chips, previous/next arrows and the current period's name; Custom opens a date sheet. */
export function RangeBar({
  state,
  onChange,
  today,
}: {
  state: RangeState;
  onChange: (s: RangeState) => void;
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const range = resolveRange(state);
  const canStep = state.preset !== "all";
  return (
    <div className="surface range-bar">
      <IonSegment
        value={state.preset}
        onIonChange={(e) => {
          const preset = e.detail.value as Preset;
          onChange({ ...state, preset });
          if (preset === "custom") setEditing(true);
        }}
      >
        {PRESETS.map((p) => (
          <IonSegmentButton key={p.value} value={p.value}>
            <IonLabel>{p.label}</IonLabel>
          </IonSegmentButton>
        ))}
      </IonSegment>
      <div className="range-step">
        <IonButton fill="clear" aria-label="Previous period" disabled={!canStep} onClick={() => onChange(stepRange(state, -1))}>
          <IonIcon slot="icon-only" icon={chevronBack} />
        </IonButton>
        <button
          type="button"
          className="range-label"
          onClick={() => state.preset === "custom" && setEditing(true)}
        >
          {range.label}
        </button>
        <IonButton
          fill="clear"
          aria-label="Next period"
          disabled={!canStep || (range.to ?? today) >= today}
          onClick={() => onChange(stepRange(state, 1))}
        >
          <IonIcon slot="icon-only" icon={chevronForward} />
        </IonButton>
      </div>
      <CustomRangeSheet
        show={editing}
        state={state}
        onClose={() => setEditing(false)}
        onApply={(from, to) => onChange({ ...state, preset: "custom", from, to })}
      />
    </div>
  );
}

function CustomRangeSheet({
  show,
  state,
  onClose,
  onApply,
}: {
  show: boolean;
  state: RangeState;
  onClose: () => void;
  onApply: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(state.from);
  const [to, setTo] = useState(state.to);
  const valid = Boolean(from && to && from <= to);
  return (
    <Sheet
      show={show}
      onClose={onClose}
      onDidPresent={() => {
        setFrom(state.from);
        setTo(state.to);
      }}
      title="Date range"
    >
      <div className="form-fields">
        <div className="field-row">
          <IonInput
            fill="outline"
            label="From"
            labelPlacement="stacked"
            type="date"
            value={from}
            onIonInput={(e) => setFrom(e.detail.value ?? "")}
          />
          <IonInput
            fill="outline"
            label="To"
            labelPlacement="stacked"
            type="date"
            value={to}
            onIonInput={(e) => setTo(e.detail.value ?? "")}
          />
        </div>
        {from && to && from > to && <div className="row-sub danger">"From" must be on or before "To".</div>}
        <IonButton
          expand="block"
          disabled={!valid}
          onClick={() => {
            onApply(from, to);
            onClose();
          }}
        >
          Apply
        </IonButton>
      </div>
    </Sheet>
  );
}
