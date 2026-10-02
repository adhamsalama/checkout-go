import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import App from "./App";
import { followSystemTheme } from "./theme";

followSystemTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </BrowserRouter>
);
