const { chromium } = await import(process.env["SAVIA_BROWSER_MODULE"] ?? "playwright");
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = "http://localhost:3000";
await mkdir("test-results/savia", { recursive: true });
for (let attempt = 0; attempt < 40; attempt++) {
  try { if ((await fetch(origin + "/api/chat")).ok) break; } catch { /* server starting */ }
  await new Promise(resolve => setTimeout(resolve, 500));
}
const status = await fetch(origin + "/api/chat");
assert.equal(status.status, 200);
assert.equal((await status.json()).enabled, false);
const foreign = await fetch(origin + "/api/chat", { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: "{}" });
assert.equal(foreign.status, 403);

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  for (const width of [390, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + "/savia", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Hola, soy Savia." }).waitFor();
    await page.getByText("Savia está en preparación.", { exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Consultar a Savia", exact: true }).isEnabled(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.screenshot({ path: `test-results/savia/${width}-unconfigured.png`, fullPage: true });

    // Test-only provider responses exercise rendering without spending real tokens.
    await page.route("**/api/chat", async route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { enabled: true, message: "Prueba aislada" } });
      const input = route.request().postDataJSON();
      assert.equal(input.period, "7d");
      assert.ok(input.question.length >= 8);
      return route.fulfill({ json: {
        answer: "Respuesta de prueba <img src=x onerror=alert(1)>",
        generatedAt: "2026-11-23T12:00:00.000Z",
        range: { start: "2026-11-16T12:00:00.000Z", end: "2026-11-23T12:00:00.000Z" },
        total: 0, maxMagnitude: null, provinces: [], days: [], events: [], mapTruncated: false,
        sources: [{ name: "USGS", url: "https://earthquake.usgs.gov/", state: "operativa" }],
      } });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Resume la actividad sísmica de Panamá en este período.", exact: true }).click();
    await page.getByRole("button", { name: "Consultar a Savia", exact: true }).click();
    await page.getByRole("log").getByText("Respuesta de prueba", { exact: false }).waitFor();
    assert.equal(await page.getByRole("log").locator("img").count(), 0);
    await page.getByRole("button", { name: "Epicentros", exact: true }).click();
    await page.getByRole("region", { name: "Mapa de sismos de Panamá" }).waitFor();
    await page.getByRole("button", { name: "Provincias", exact: true }).click();
    await page.getByText("Sin epicentros terrestres asignados", { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.screenshot({ path: `test-results/savia/${width}-chat.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(`Savia ${width}px: SSR, disponibilidad, sugerencias, envío, mapa, gráfica y texto seguro verificados`);
    await page.close();
  }
} finally { await browser.close(); }
