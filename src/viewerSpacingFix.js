/* Additive viewer spacing and Markdown rule styling. */

const applyViewerSpacing = () => {
  if (document.getElementById("archiwiki-viewer-spacing-style")) return;

  const style = document.createElement("style");
  style.id = "archiwiki-viewer-spacing-style";
  style.textContent = `
    /* The viewer's real scroll workspace is the direct parent of #print-container. */
    div:has(> #print-container) {
      padding-top: 0.75rem !important;
      padding-bottom: 34px !important;
    }

    /* Keep the note title itself close to the breadcrumb bar. */
    #print-container .wiki-content > h1 {
      margin-top: 0 !important;
      margin-bottom: 1.25rem !important;
    }

    /* Markdown thematic breaks: --- / *** / ___ */
    #print-container .wiki-content hr {
      display: block;
      width: 100%;
      height: 1px;
      margin: 1.5rem 0;
      border: 0;
      border-top: 1px solid currentColor;
      opacity: 0.28;
    }

    .dark #print-container .wiki-content hr {
      opacity: 0.45;
    }

    @media (max-width: 767px) {
      div:has(> #print-container) {
        padding-bottom: 58px !important;
      }
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
