import { IonFab, IonFabButton, IonIcon } from "@ionic/react";
import { add } from "ionicons/icons";

/** Pass to `<Page fab>`; it must sit directly in the page's IonContent. */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IonFab slot="fixed" vertical="bottom" horizontal="end">
      <IonFabButton aria-label={label} onClick={onClick}>
        <IonIcon icon={add} />
      </IonFabButton>
    </IonFab>
  );
}
