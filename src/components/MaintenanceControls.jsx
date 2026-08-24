import React, { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const maintenanceRef = doc(db, "adminUsers", "maintenance");

export default function MaintenanceControls() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return onSnapshot(
      maintenanceRef,
      (snapshot) => {
        setEnabled(snapshot.exists() && snapshot.data()?.inMaintenance === true);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error("Failed to load maintenance status:", err);
        setError("Unable to load maintenance status.");
        setLoading(false);
      }
    );
  }, []);

  const toggle = async () => {
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      await setDoc(
        maintenanceRef,
        {
          inMaintenance: !enabled,
          updatedAt: Date.now()
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to update maintenance mode:", err);
      setError(err?.message || "Unable to change maintenance mode.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-300 rounded p-6 mb-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="font-semibold">Maintenance mode</h2>
          <p className="text-xs text-neutral-500 mt-1 max-w-xl">
            When enabled, regular users cannot access the login screen. The administrator page remains available.
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={loading || saving}
          aria-pressed={enabled}
          className={
            "relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 " +
            (enabled ? "bg-neutral-900" : "bg-neutral-300")
          }
        >
          <span
            className={
              "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform " +
              (enabled ? "translate-x-6" : "translate-x-1")
            }
          />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs">
        <span className={"h-2 w-2 rounded-full " + (enabled ? "bg-amber-500" : "bg-green-600")} />
        <span className="text-neutral-600">
          {loading ? "Checking…" : enabled ? "Maintenance is ON" : "Maintenance is OFF"}
        </span>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
