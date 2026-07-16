import { unstable_dev } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

describe("E2E API Tests", () => {
  let worker: any;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
      local: true
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it("should block unauthenticated access to admin routes", async () => {
    const res = await worker.fetch("/api/admin/clients", {
      method: "GET",
    });
    expect(res.status).toBe(401);
  }, 15000);

  it("should respond with 401 on missing auth for protected POSTs", async () => {
    const res = await worker.fetch("/api/jobs", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    });
    expect(res.status).toBe(401);
  }, 15000);
});
