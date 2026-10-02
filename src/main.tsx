import ReactDOM from "react-dom/client";
import { setupIonicReact } from "@ionic/react";
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/palettes/dark.system.css";
import "./styles.css";
import App from "./App";

// Material Design styling on every platform, including desktop browsers during development.
setupIonicReact({ mode: "md" });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
