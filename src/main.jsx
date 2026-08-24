import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./sameNoteAnchors.js";
import "./wikiEnhancements.js";
import "./uiFixes.js";
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
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}