import { PDFDocument } from "pdf-lib";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const MERGEABLE_EXT = ["pdf", "jpg", "jpeg", "png"];

/** Merge supporting PDF/image files into the main PDF. Returns merged bytes. */
export async function mergeSupportingFilesIntoPdf(
  mainPdfBuffer: ArrayBuffer,
  supportingFiles: { name: string; buf: Buffer }[]
): Promise<Uint8Array> {
  const toMerge = supportingFiles.filter(({ name }) => {
    const ext = name.split(".").pop()?.toLowerCase();
    return ext && MERGEABLE_EXT.includes(ext);
  });
  if (toMerge.length === 0) return new Uint8Array(mainPdfBuffer);

  const mainDoc = await PDFDocument.load(mainPdfBuffer);

  for (const { name, buf } of toMerge) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      try {
        const srcDoc = await PDFDocument.load(buf);
        const pages = await mainDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        pages.forEach((p) => mainDoc.addPage(p));
      } catch {
        // Skip invalid PDF
      }
    } else if (["jpg", "jpeg", "png"].includes(ext ?? "")) {
      try {
        const page = mainDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        const bytes = new Uint8Array(buf);
        const image = ext === "png"
          ? await mainDoc.embedPng(bytes)
          : await mainDoc.embedJpg(bytes);
        const dims = image.scaleToFit(A4_WIDTH - 40, A4_HEIGHT - 40);
        page.drawImage(image, {
          x: 20 + (A4_WIDTH - 40 - dims.width) / 2,
          y: A4_HEIGHT - 20 - dims.height,
          width: dims.width,
          height: dims.height,
        });
      } catch {
        // Skip invalid image
      }
    }
  }

  return mainDoc.save();
}
