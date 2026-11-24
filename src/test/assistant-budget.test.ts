import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { RESERVE } from "@/features/assistant/budget.server";

const container = process.env["SAVIA_TEST_REDIS_CONTAINER"];
const exec = promisify(execFile);

// CI runs these scripts against a dedicated ephemeral Redis, checking races in
// the actual Lua implementation rather than reproducing its logic in a mock.
describe.skipIf(!container)("Savia atomic quotas in real Redis", () => {
  it("admits only two simultaneous leases and enforces the minute cap after release", async () => {
    const prefix = randomUUID();
    const keys = ["minute", "visitor", "day", "month", "active"].map(key => prefix + key);
    const now = Date.now();
    async function reserve(lease: string) {
      const { stdout } = await exec("docker", ["exec", container!, "redis-cli", "--raw", "EVAL", RESERVE, "5", ...keys,
        "3", "10", "100", "1500", String(now), "2", String(now + 45000), "120", "172800", "172800", "5356800", lease]);
      return Number(stdout.trim());
    }
    const admissions = await Promise.all(Array.from({ length: 12 }, (_, i) => reserve(String(i))));
    expect(admissions.reduce((sum, value) => sum + value, 0)).toBe(2);
    await exec("docker", ["exec", container!, "redis-cli", "DEL", keys[4]!]);
    expect(await reserve("extra")).toBe(1);
    expect(await reserve("excess")).toBe(0);
    const { stdout } = await exec("docker", ["exec", container!, "redis-cli", "--raw", "GET", keys[2]!]);
    expect(Number(stdout.trim())).toBe(3);
  }, 20000);

  it("blocks the global daily cap even with a new visitor", async () => {
    const prefix = randomUUID();
    const keys = ["minute", "visitor", "day", "month", "active"].map(key => prefix + key);
    await exec("docker", ["exec", container!, "redis-cli", "SET", keys[2]!, "100"]);
    const now = Date.now();
    const { stdout } = await exec("docker", ["exec", container!, "redis-cli", "--raw", "EVAL", RESERVE, "5", ...keys,
      "3", "10", "100", "1500", String(now), "2", String(now + 45000), "120", "172800", "172800", "5356800", "lease"]);
    expect(Number(stdout.trim())).toBe(0);
  });
});
