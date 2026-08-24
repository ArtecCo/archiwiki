/* Additive viewer-only spacing fix. */

const applyViewerSpacing = () => {
  if (document.getElementById("archiwiki-viewer-spacing-style")) return;

  const style = document.createElement("style");
  style.id = "archiwiki-viewer-spacing-style";
  style.textContent = `
    /* The viewer's real scroll workspace is the direct parent of #print-container. */
    div:has(> #print-container) {
      padding-top: 0.75rem !important;
    }

    /* Keep the note title itself close to the breadcrumb bar. */
    #print-container .wiki-content > h1 {
      margin-top: 0 !important;
      margin-bottom: 1.25rem !important;
    }
  `;
  document.head.appendChild(style);
};

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyViewerSpacing, { once: true });
  } else {
    applyViewerSpacing();
  }
}
