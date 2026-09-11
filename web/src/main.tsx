import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LangProvider } from "./lib/i18n";
import { AuthGate } from "./components/AuthGate";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LangProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </LangProvider>
  </React.StrictMode>
);
