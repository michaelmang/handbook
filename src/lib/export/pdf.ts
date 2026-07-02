import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { generateHandbookHtml } from "./html";
import type { Project } from "../types";

export async function generatePdf(project: Project): Promise<Buffer> {
  const html = await generateHandbookHtml(project);

  const isDev = process.env.NODE_ENV === "development";

  let browser;
  if (isDev) {
    // Local dev: try system Chrome
    const executablePath =
      process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : process.platform === "win32"
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : "/usr/bin/google-chrome";

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  } else {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 816, height: 1056 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    // Allow Google Fonts to load
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
