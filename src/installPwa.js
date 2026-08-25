const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator.standalone === true;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const createInstallButton = () => {
  if (document.getElementById("archiwiki-install-button")) {
    return document.getElementById("archiwiki-install-button");
  }

  const button = document.createElement("button");
  button.id = "archiwiki-install-button";
  button.type = "button";
  button.textContent = "Install ArchiWiki";
  button.setAttribute("aria-label", "Install ArchiWiki");

  Object.assign(button.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "9998",
    display: "none",
    padding: "9px 14px",
    border: "1px solid currentColor",
    borderRadius: "999px",
    background: "var(--archiwiki-install-bg, #F5F2EB)",
    color: "var(--archiwiki-install-fg, #3F372B)",
    fontFamily: 'Montserrat, system-ui, sans-serif',
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,0.10)"
  });

  document.body.appendChild(button);
  return button;
};

const showIOSInstructions = () => {
  window.alert(
    "To install ArchiWiki on iPhone or iPad:\n\n" +
    "1. Tap the Share button in Safari.\n" +
    "2. Choose 'Add to Home Screen'.\n" +
    "3. Tap 'Add'."
  );
};

const initInstallPrompt = () => {
  if (typeof window === "undefined" || isStandalone()) return;

  let deferredPrompt = null;
  let promptInProgress = false;
  const button = createInstallButton();

  const hide = () => {
    button.style.display = "none";
  };

  const show = () => {
    button.style.display = "block";
  };

  const launchNativePrompt = async () => {
    if (!deferredPrompt || promptInProgress) return false;

    promptInProgress = true;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    hide();

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      // The browser may reject a prompt if its install criteria changed.
    } finally {
      promptInProgress = false;
    }

    return true;
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the browser's install event until the user performs a gesture.
    // Calling prompt() without a user activation is rejected by Chromium.
    event.preventDefault();
    deferredPrompt = event;
    show();
  });

  button.addEventListener("click", async () => {
    if (deferredPrompt) {
      await launchNativePrompt();
      return;
    }

    if (isIOS()) {
      showIOSInstructions();
    }
  });

  // If the browser has already made an install event available before the
  // listener above was attached, give the user a gesture-based fallback.
  const gestureFallback = async () => {
    if (deferredPrompt) {
      await launchNativePrompt();
      window.removeEventListener("pointerdown", gestureFallback, true);
      window.removeEventListener("keydown", gestureFallback, true);
    }
  };

  window.addEventListener("pointerdown", gestureFallback, true);
  window.addEventListener("keydown", gestureFallback, true);

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hide();
  });

  if (isIOS()) {
    show();
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initInstallPrompt, { once: true });
} else {
  initInstallPrompt();
}
