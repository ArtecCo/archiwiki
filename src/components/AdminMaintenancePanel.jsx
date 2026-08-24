import React, { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";

const maintenanceRef = doc(db, "adminUsers", "maintenance");

export default function AdminMaintenancePanel() {
  const [authorized, setAuthorized] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    return onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

      if (!user) {
        setAuthorized(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "adminUsers", user.uid));

        if (mounted) {
          setAuthorized(
            snap.exists() &&
            snap.data()?.active === true
          );
        }
      } catch (err) {
        console.error("Failed to verify admin access:", err);
        if (mounted) setAuthorized(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!authorized) return;

    return onSnapshot(
      maintenanceRef,
      async (snap) => {
        if (!snap.exists()) {
          // Create the requested boolean field with the safe default.
          try {
            await setDoc(
              maintenanceRef,
              {
                inMaintenance: false,
                updatedAt: Date.now()
              },
              { merge: true }
            );
          } catch (err) {
            console.error("Failed to initialize maintenance flag:", err);
          }
          setEnabled(false);
          return;
        }

        setEnabled(
          snap.data()?.inMaintenance === true
        );
        setError("");
      },
      (err) => {
        console.error("Failed to load maintenance mode:", err);
        setError("Unable to read maintenance status.");
      }
    );
  }, [authorized]);

  if (!authorized) return null;

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
      setError(
        err?.message ||
        "Unable to update maintenance mode."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[100] w-72 rounded-xl border border-neutral-300 bg-white/95 p-4 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            Maintenance mode
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {enabled
              ? "Users are currently blocked."
              : "Users can access ArchiWiki."}
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-label={
            enabled
              ? "Turn maintenance mode off"
              : "Turn maintenance mode on"
          }
          aria-pressed={enabled}
          className={
            "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 " +
            (enabled
              ? "bg-neutral-900"
              : "bg-neutral-300")
          }
        >
          <span
            className={
              "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform " +
              (enabled
                ? "translate-x-6"
                : "translate-x-1")
            }
          />
        </button>
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
