import { useIonActionSheet, useIonAlert, useIonToast } from "@ionic/react";
import { useMemo } from "react";

/** Promise-based wrappers around Ionic's alert, action sheet and toast. */
export function useDialogs() {
  const [presentAlert] = useIonAlert();
  const [presentSheet] = useIonActionSheet();
  const [presentToast] = useIonToast();

  return useMemo(
    () => ({
      /** Action sheet with one destructive button; resolves true if it was tapped. */
      confirmDelete: (header: string, text = "Delete") =>
        new Promise<boolean>((resolve) =>
          presentSheet({
            header,
            buttons: [
              { text, role: "destructive" },
              { text: "Cancel", role: "cancel" },
            ],
            onDidDismiss: (e) => resolve(e.detail.role === "destructive"),
          })
        ),

      /** Alert with OK/Cancel; resolves true on OK. */
      confirm: (header: string, message: string, okText = "OK") =>
        new Promise<boolean>((resolve) =>
          presentAlert({
            header,
            message,
            buttons: [
              { text: "Cancel", role: "cancel" },
              { text: okText, role: "confirm" },
            ],
            onDidDismiss: (e) => resolve(e.detail.role === "confirm"),
          })
        ),

      /** Shows an error from an API call. */
      showError: (err: unknown) => {
        console.error(err);
        presentAlert({ header: "Error", message: err instanceof Error ? err.message : String(err), buttons: ["OK"] });
      },

      toast: (message: string) => presentToast({ message, duration: 2500, position: "bottom", positionAnchor: "tab-bar" }),
    }),
    [presentAlert, presentSheet, presentToast]
  );
}
