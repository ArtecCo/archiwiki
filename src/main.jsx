import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./context/AuthContext.jsx";

const root = ReactDOM.createRoot(
  document.getElementById("root")
);

const pathname = window.location.pathname;

if (pathname === "/invite-admin") {
  // IMPORTANT:
  // The admin panel has its own Firebase Auth handling.
  // Do NOT put it inside the application's AuthProvider.
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
