import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import { close } from "ionicons/icons";
import { ReactNode, useRef } from "react";

/**
 * A bottom sheet sized to its content. Swipe down, the close button, the backdrop and the Android
 * back button all dismiss it through onClose.
 */
export function Sheet({
  show,
  onClose,
  onDidPresent,
  title,
  children,
}: {
  show: boolean;
  onClose: () => void;
  onDidPresent?: () => void;
  title: string;
  children: ReactNode;
}) {
  const modal = useRef<HTMLIonModalElement>(null);
  return (
    <IonModal
      ref={modal}
      className="sheet"
      isOpen={show}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      onDidPresent={onDidPresent}
      onDidDismiss={onClose}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Close" onClick={() => modal.current?.dismiss()}>
              <IonIcon slot="icon-only" icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">{children}</IonContent>
    </IonModal>
  );
}

/**
 * Keeps the last non-null value, so a sheet's contents don't change while it animates closed
 * after its state was cleared.
 */
export function useLastValue<T>(value: T | null): T | null {
  const last = useRef(value);
  if (value !== null) last.current = value;
  return last.current;
}
