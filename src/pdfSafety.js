/*
 * Additive PDF safety layer.
 * Keeps the existing PDF renderer and styling intact while giving jsPDF
 * deterministic break points inside exceptionally long tokens (URLs,
 * hashes, long identifiers, etc.).
 */

import { jsPDF } from "jspdf";

const ORIGINAL = jsPDF.API.splitTextToSize;

if (!jsPDF.API.__archiwikiSafeSplitTextToSize) {
  jsPDF.API.splitTextToSize = function (text, maxlen, options) {
    const value = String(text ?? "");

    // jsPDF normally wraps at whitespace. A single very long token can
    // therefore remain wider than the printable area. Add hard break
    // opportunities only to tokens that are exceptionally long.
    const safe = value
      .split("\n")
      .map((line) => {
        const parts = line.split(/(\s+)/);

        return parts
          .map((part) => {
            if (/\s/.test(part) || part.length <= 36) {
              return part;
            }

            const chunks = [];
            for (let i = 0; i < part.length; i += 36) {
              chunks.push(part.slice(i, i + 36));
            }

            return chunks.join("\n");
          })
          .join("");
      })
      .join("\n");

    return ORIGINAL.call(this, safe, maxlen, options);
  };

  jsPDF.API.__archiwikiSafeSplitTextToSize = true;
}
