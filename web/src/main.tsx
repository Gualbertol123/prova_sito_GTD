import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LangProvider } from "./lib/i18n";
import { IdentityProvider } from "./lib/identity";
import { AuthGate } from "./components/AuthGate";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LangProvider>
      <IdentityProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </IdentityProvider>
    </LangProvider>
  </React.StrictMode>
);
