const { chromium } = await import(process.env["SAVIA_BROWSER_MODULE"] ?? "playwright");
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = "http://localhost:3000";
await mkdir("test-results/savia", { recursive: true });
for (let attempt = 0; attempt < 40; attempt++) {
  try { if ((await fetch(origin + "/api/chat")).ok) break; } catch { /* server starting */ }
  await new Promise(resolve => setTimeout(resolve, 500));
}
assert.equal((await fetch(origin + "/api/chat")).status, 200);
const foreign = await fetch(origin + "/api/chat", { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: "{}" });
assert.equal(foreign.status, 403);

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  for (const width of [390, 1024, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/chat", async route => {
      if (route.request().method() !== "POST") return route.continue();
      const input = route.request().postDataJSON();
      assert.equal(input.period, "7d");
      assert.ok(input.question.length >= 8);
      await new Promise(resolve => setTimeout(resolve, input.question.includes("cancelar") ? 2500 : 700));
      const wantsMap = input.question.includes("mapa");
      const reply = {
        answer: "Respuesta de prueba <img src=x onerror=alert(1)>",
        mode: "ai", generatedAt: "2026-11-23T12:00:00.000Z",
        range: { start: "2026-11-16T12:00:00.000Z", end: "2026-11-23T12:00:00.000Z" },
        total: 0, maxMagnitude: null, provinces: [], days: [], events: [], mapTruncated: false,
        sources: [{ name: "USGS", url: "https://earthquake.usgs.gov/", state: "operativa" }],
        presentation: { views: [wantsMap ? "map" : "table"], regions: wantsMap ? ["Chiriquí"] : [], tableKind: "provinces", chartKind: "daily" },
      };
      return route.fulfill({ contentType: "text/event-stream", body: [
        { type: "phase", phase: "sources" }, { type: "phase", phase: "analyzing" },
        { type: "phase", phase: "presenting" }, { type: "result", reply },
      ].map(event => `data: ${JSON.stringify(event)}\n\n`).join("") });
    });
    await page.goto(origin + "/savia", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Hola, soy Savia." }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/savia/${width}-welcome.png`, fullPage: true });

    await page.getByRole("button", { name: "Haz una tabla comparando los sismos por provincia.", exact: true }).click();
    await page.getByRole("button", { name: "Consultar a Savia", exact: true }).click();
    await page.getByRole("status").getByText("Preparando tu consulta", { exact: true }).waitFor();
    await page.getByRole("log").getByText("Respuesta de prueba", { exact: false }).waitFor();
    assert.equal(await page.getByRole("log").locator("img").count(), 0);
    await page.getByRole("table").waitFor();
    assert.equal(await page.getByRole("button", { name: "Tabla", exact: true }).getAttribute("aria-pressed"), "true");
    await page.screenshot({ path: `test-results/savia/${width}-table.png`, fullPage: true });

    await page.getByLabel("Tu pregunta sobre Panamá", { exact: true }).fill("Muéstrame un mapa de calor de los sismos de Chiriquí.");
    await page.getByRole("button", { name: "Consultar a Savia", exact: true }).click();
    await page.getByRole("region", { name: "Mapa de sismos de Panamá" }).waitFor();
    const articles = page.getByRole("log").locator("article");
    assert.equal(await articles.count(), 2);
    await articles.last().getByRole("button", { name: "Gráfica", exact: true }).click();
    await page.getByRole("img", { name: "Gráfica de evolución diaria de sismos terrestres y marítimos" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/savia/${width}-map.png`, fullPage: true });
    await page.getByRole("button", { name: "Limpiar chat", exact: true }).click();
    assert.equal(await articles.count(), 0);
    await page.getByLabel("Tu pregunta sobre Panamá", { exact: true }).fill("Sismos de Panamá para cancelar");
    await page.getByRole("button", { name: "Consultar a Savia", exact: true }).click();
    await page.getByText("1 s transcurridos", { exact: true }).waitFor();
    await page.screenshot({ path: `test-results/savia/${width}-thinking.png`, fullPage: true });
    await page.getByRole("button", { name: "Limpiar chat", exact: true }).click();
    await page.getByLabel("Tu pregunta sobre Panamá", { exact: true }).fill("Tabla de sismos de Panamá");
    await page.getByRole("button", { name: "Consultar a Savia", exact: true }).click();
    await page.getByRole("table").waitFor();
    await page.waitForTimeout(2700);
    assert.equal(await articles.count(), 1);
    assert.equal(await articles.first().getByRole("heading").textContent(), "Tabla de sismos de Panamá");
    await page.getByLabel("Tu pregunta sobre Panamá", { exact: true }).fill("Sismos de Panamá para cancelar");
    await page.getByRole("button", { name: "Consultar a Savia", exact: true }).click();
    await page.getByRole("button", { name: "Detener consulta", exact: true }).click();
    await page.waitForTimeout(2700);
    assert.equal(await articles.count(), 1);
    assert.equal(await page.getByRole("progressbar").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log(`Savia ${width}px: bienvenida, fases, tabla automática, mapa automático, gráfica, historial y texto seguro verificados`);
    await page.close();
  }
} finally { await browser.close(); }
