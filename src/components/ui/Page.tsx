import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { ReactNode } from "react";

/** A screen: toolbar with title/actions, scrollable content, and an optional FAB and overlays. */
export function Page({
  title,
  back,
  actions,
  fab,
  children,
}: {
  title: string;
  /** Shows a back button; the value is where it goes when there's no history. */
  back?: string;
  actions?: ReactNode;
  fab?: ReactNode;
  children: ReactNode;
}) {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          {back && (
            <IonButtons slot="start">
              <IonBackButton defaultHref={back} />
            </IonButtons>
          )}
          <IonTitle>{title}</IonTitle>
          {actions && <IonButtons slot="end">{actions}</IonButtons>}
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="page-body">{children}</div>
        {fab}
      </IonContent>
    </IonPage>
  );
}
