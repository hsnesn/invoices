/**
 * PDF font utility for Turkish/UTF-8 character support.
 * jsPDF's default Helvetica font does not support Turkish characters (ğ, ş, ı, ü, ö, ç).
 * We load Roboto which has full Turkish support.
 */

const FONT_NAME = "Roboto";
const FONT_STYLE = "normal";
const FONT_PATH = "/fonts/Roboto-Regular.ttf";

let fontBase64Cache: string | null = null;

async function getFontBase64(): Promise<string> {
  if (fontBase64Cache) return fontBase64Cache;
  const res = await fetch(FONT_PATH);
  if (!res.ok) throw new Error("Font fetch failed");
  const arrayBuffer = await res.arrayBuffer();
  fontBase64Cache = arrayBufferToBase64(arrayBuffer);
  return fontBase64Cache;
}

/**
 * Ensures the Roboto font is loaded into the jsPDF document and sets it as active.
 * Call this at the start of any PDF export that may contain Turkish characters.
 */
export async function ensurePdfFont(doc: import("jspdf").jsPDF): Promise<void> {
  try {
    const base64 = await getFontBase64();
    doc.addFileToVFS("Roboto-Regular.ttf", base64);
    doc.addFont("Roboto-Regular.ttf", FONT_NAME, FONT_STYLE);
    doc.setFont(FONT_NAME, FONT_STYLE);
  } catch (e) {
    console.warn("Could not load Roboto font for PDF, Turkish characters may not display:", e);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
