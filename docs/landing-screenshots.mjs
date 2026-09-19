// Regenerates the screenshots the landing page shows of the patient app, so
// the page always matches the real product. Run against a built server:
//
//   npm run build && npm start          # in one terminal, serves on :3001
//   npm install --no-save puppeteer-core
//   node docs/landing-screenshots.mjs   # writes public/welcome/img/*.webp
//
// It signs in as the demo patient (Bayfront Health, BAY-2741), hides the demo
// controls bar, and captures each section of the patient app at phone size,
// plus the readings detail card at desktop size. Nothing is drawn by hand.
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public/welcome/img/",
);
const BASE = process.env.RELAY_URL || "http://127.0.0.1:3001";
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
});

async function signIn(page) {
  await page.goto(`${BASE}/#/patient`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#rx-hospital", { timeout: 15000 });
  const value = await page.$eval(
    "#rx-hospital",
    (sel) =>
      [...sel.options].find((o) => /bayfront/i.test(o.textContent)).value,
  );
  await page.select("#rx-hospital", value);
  await page.type("#rx-code", "BAY-2741");
  await page.click(".rx-p-consent input");
  await page.click(".rx-p-btn.primary");
  await page.waitForSelector(".rx-pweb", { timeout: 15000 });
  await page.addStyleTag({ content: ".rx-demobar{display:none!important}" });
  await page.evaluate(() => document.fonts.ready);
}

// Phone-size captures of each section.
const phone = await browser.newPage();
await phone.setViewport({
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await signIn(phone);
for (const [name, hash] of [
  ["m-home", "#/patient"],
  ["m-checkin", "#/patient/checkin"],
  ["m-readings", "#/patient/readings"],
  ["m-care", "#/patient/care"],
  ["m-connect", "#/patient/connect"],
]) {
  await phone.evaluate((h) => {
    location.hash = h;
  }, hash);
  await new Promise((r) => setTimeout(r, 1800));
  await phone.evaluate(() => window.scrollTo(0, 0));
  await phone.screenshot({
    path: `${OUT}/${name}.webp`,
    type: "webp",
    quality: 86,
  });
  console.log("wrote", `${name}.webp`);
}
await phone.close();

// The readings detail card, cropped from the desktop layout.
const desk = await browser.newPage();
await desk.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
await signIn(desk);
await desk.evaluate(() => {
  location.hash = "#/patient/readings";
});
await desk.waitForSelector(".rx-ph-detail", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1500));
const card = await desk.$(".rx-ph-detail");
await card.screenshot({
  path: `${OUT}/readings-chart.webp`,
  type: "webp",
  quality: 88,
});
console.log("wrote readings-chart.webp");
await browser.close();
