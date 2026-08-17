import CryptoJS from "crypto-js";

/**
 * Derives a strong 256-bit AES key locally using PBKDF2.
 * Uses a static system salt to guarantee identical key derivation from the same password.
 */
export const deriveMasterKey = (masterPassword, uid) => {
  // Use user's Firebase UID as a deterministic salt for key derivation
  const salt = CryptoJS.enc.Hex.parse(CryptoJS.SHA256(uid).toString());
  const key = CryptoJS.PBKDF2(masterPassword, salt, {
    keySize: 256 / 32, // 256-bit key (8 words)
    iterations: 10000,
    hasher: CryptoJS.algo.SHA256
  });
  return key.toString(CryptoJS.enc.Hex);
};

/**
 * Encrypts a plaintext string using client-side AES-256.
 * Returns a secure base64 string combining initialization vector (IV) and ciphertext.
 */
export const encryptData = (plaintext, hexKey) => {
  if (!plaintext) return "";
  try {
    const key = CryptoJS.enc.Hex.parse(hexKey);
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Package IV and Ciphertext together cleanly
    const payload = {
      ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
      iv: iv.toString(CryptoJS.enc.Hex)
    };
    return JSON.stringify(payload);
  } catch (err) {
    console.error("Encryption error:", err);
    return "";
  }
};

/**
 * Decrypts a payload string back to plain text.
 * Gracefully reports key errors without crashing UI rendering.
 */
export const decryptData = (payloadString, hexKey) => {
  if (!payloadString) return "";
  if (!hexKey) return "[Key Missing]";
  try {
    const payload = JSON.parse(payloadString);
    const key = CryptoJS.enc.Hex.parse(hexKey);
    const iv = CryptoJS.enc.Hex.parse(payload.iv);
    const ciphertext = CryptoJS.enc.Base64.parse(payload.ct);

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertext },
      key,
      { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    console.error("Decryption failure. Invalid Master Password.");
    return "[Decryption Failure]";
  }
};

