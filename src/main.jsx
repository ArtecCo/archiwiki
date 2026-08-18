import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import InviteAdmin from "./components/InviteAdmin.jsx";
import "./index.css";
import { AuthProvider } from "./context/AuthContext.jsx";

const isInviteAdmin =
  window.location.pathname === "/invite-admin";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isInviteAdmin ? (
      <InviteAdmin />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </React.StrictMode>
);
