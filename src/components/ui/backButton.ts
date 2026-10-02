import { Capacitor } from "@capacitor/core";

// Android's back button closes the most recently opened sheet before navigating back.
const closers: (() => void)[] = [];

export function pushBackHandler(close: () => void): () => void {
  closers.push(close);
  return () => {
    const i = closers.lastIndexOf(close);
    if (i !== -1) closers.splice(i, 1);
  };
}

export async function installBackButton(goBack: () => boolean) {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import("@capacitor/app");
  App.addListener("backButton", () => {
    const close = closers.pop();
    if (close) close();
    else if (!goBack()) App.exitApp();
  });
}
