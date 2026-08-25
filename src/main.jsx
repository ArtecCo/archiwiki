import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import MaintenanceGate from "./components/MaintenanceGate.jsx";
import "./index.css";
import "./mobileEditorMetricsFix.css";
import "./sameNoteAnchors.js";
import "./wikiEnhancements.js";
import "./finalUiFixes.js";
import "./scrollPositionFix.js";
import "./viewerSpacingFix.js";
import { AuthProvider } from "./context/AuthContext.jsx";

const root = ReactDOM.createRoot(
  document.getElementById("root")
);

const pathname = window.location.pathname;

if (pathname === "/invite-admin") {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <MaintenanceGate>
          <App />
        </MaintenanceGate>
      </AuthProvider>
    </React.StrictMode>
  );
}