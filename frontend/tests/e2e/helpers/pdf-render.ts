import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Page } from "@playwright/test";

const ORIGIN = "http://pdf-render.test";
const pdfjsDir = join(process.cwd(), "node_modules", "pdfjs-dist", "build");

export interface RenderedPdf {
  /** The first page drawn by pdf.js, as a PNG. */
  png: Buffer;
  pages: number;
  /** Page size in PDF points. */
  size: { width: number; height: number };
  /** Every font the page uses, as pdf.js loaded it: the PostScript name and whether the file was found inside the PDF. */
  fonts: { name: string; embedded: boolean }[];
}

/**
 * Draws page 1 of a PDF with pdf.js in the browser, so a test sees what a reader sees: the glyphs of the
 * embedded fonts, the stamp, the pill and the watermark. Needs no server: the page and pdf.js are served by route.
 */
export async function renderPdf(page: Page, bytes: Uint8Array, scale = 2): Promise<RenderedPdf> {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") return route.fulfill({ contentType: "text/html", body: "<!doctype html><meta charset=utf-8><body style='margin:0'><canvas id=c></canvas>" });
    const file = pathname.replace("/pdfjs/", "");
    return route.fulfill({ contentType: "text/javascript", body: await readFile(join(pdfjsDir, file)) });
  });
  await page.goto(`${ORIGIN}/`);
  const result = await page.evaluate(
    async ({ base64, scale: s, origin }) => {
      const pdfjs = await import(/* @vite-ignore */ `${origin}/pdfjs/pdf.min.mjs`);
      pdfjs.GlobalWorkerOptions.workerSrc = `${origin}/pdfjs/pdf.worker.min.mjs`;
      const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const doc = await pdfjs.getDocument({ data, fontExtraProperties: true }).promise;
      const first = await doc.getPage(1);
      const viewport = first.getViewport({ scale: s });
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await first.render({ canvasContext: context, viewport, canvas }).promise;
      const content = await first.getTextContent();
      const fonts = [...new Set(content.items.map((item: { fontName?: string }) => item.fontName ?? ""))].map((id) => {
        const font = first.commonObjs.has(id) ? first.commonObjs.get(id) : null;
        return { name: String(font?.name ?? ""), embedded: font ? font.missingFile !== true : false };
      });
      const [x0, y0, x1, y1] = first.view;
      return { png: canvas.toDataURL("image/png").split(",")[1] ?? "", pages: doc.numPages, size: { width: x1 - x0, height: y1 - y0 }, fonts };
    },
    { base64: Buffer.from(bytes).toString("base64"), scale, origin: ORIGIN },
  );
  return { ...result, png: Buffer.from(result.png, "base64") };
}
