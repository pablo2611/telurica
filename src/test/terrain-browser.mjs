import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = await import(process.env["TERRAIN_BROWSER_MODULE"] ?? "playwright");
const origin = process.env["TERRAIN_ORIGIN"] ?? "http://localhost:3000";
await mkdir("test-results/terrain", { recursive: true });
for (let attempt = 0; attempt < 40; attempt++) {
  try { if ((await fetch(origin + "/terrenos")).ok) break; } catch { /* server starting */ }
  await new Promise(resolve => setTimeout(resolve, 500));
}
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  for (const width of [390, 1024, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce", acceptDownloads: true });
    const errors = [];
    let aiCalls = 0;
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() === "POST" && request.url().endsWith("/api/chat")) aiCalls++; });
    await page.goto(origin + "/terrenos", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Antes de construir, conoce el lugar." }).waitFor();
    await page.getByRole("button", { name: "Boquete Montaña", exact: true }).click();
    await page.getByRole("heading", { name: "Chiriquí", exact: true }).waitFor();
    await page.locator(".terrain-metrics article").first().getByText(/^-?\d+ m$/).waitFor({ timeout: 25000 });
    assert.match(await page.locator(".terrain-metrics article").nth(1).locator("strong").innerText(), /^\d+(?:\.\d+)?°$/);
    await page.locator(".terrain-map-label").getByText("Relieve real · escala vertical 1×", { exact: true }).waitFor({ timeout: 25000 });
    await page.locator('.terrain-viewport[data-map-settled="true"]').waitFor({ timeout: 45000 });
    await page.locator(".terrain-viewport").screenshot({ path: `test-results/terrain/${width}-rural.png` });
    await page.getByLabel("Latitud", { exact: true }).fill("9.93");
    await page.getByLabel("Longitud", { exact: true }).fill("-84.09");
    await page.getByRole("button", { name: "Ubicar coordenadas", exact: true }).click();
    await page.getByRole("alert").getByText("El punto queda fuera", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Ciudad de Panamá Ciudad", exact: true }).click();
    await page.getByRole("heading", { name: "Panamá", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Edificios 3D", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Relieve 3D", exact: true }).click();
    await page.locator(".terrain-map-label").getByText("Edificios 3D · OSM", { exact: true }).waitFor();
    await page.getByLabel("Radio alrededor del punto", { exact: true }).selectOption("5");
    await page.locator('.terrain-viewport[data-map-settled="true"]').waitFor({ timeout: 45000 });
    assert.ok(Number(await page.locator(".terrain-viewport").getAttribute("data-visible-buildings")) > 0, "No se renderizaron edificios en la ciudad");
    await page.locator(".terrain-viewport").screenshot({ path: `test-results/terrain/${width}-city.png` });
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator(".terrain-workspace").isVisible(), false);
    assert.equal(await page.locator(".terrain-report").isVisible(), true);
    await page.emulateMedia({ media: "screen" });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar ficha", exact: true }).click();
    const download = await downloadPromise;
    const report = JSON.parse(await readFile(await download.path(), "utf8"));
    assert.equal(report.status, "incompleta");
    assert.equal(report.location.longitude, -79.518);
    assert.equal(report.province, "Panamá");
    assert.ok(report.pending.length >= 4);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole("link", { name: "Preparar una consulta con Savia", exact: true }).click();
    assert.match(await page.getByLabel("Tu pregunta sobre Panamá", { exact: true }).inputValue(), /estudios necesarios antes de construir/);
    assert.equal(aiCalls, 0);
    assert.deepEqual(errors, []);
    console.log(`Terrenos ${width}px: relieve real, selección rural/urbana, edificios, coordenadas, exportación, consulta voluntaria de IA y ausencia de desbordamiento verificados`);
    await page.close();
  }
} finally { await browser.close(); }
