import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TestHarness } from "../test-utils/harness.js";

let h: TestHarness;

beforeAll(async () => {
  h = await TestHarness.create();
});

afterAll(async () => {
  await h.shutdown();
});

describe("HTTP health endpoint", () => {
  it("returns healthy status", async () => {
    const { status, body } = await h.httpGet("/health");
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "healthy" });
  });

  it("reports correct connection count", async () => {
    const { body: bodyBefore } = await h.httpGet("/health");
    expect(bodyBefore).toMatchObject({ connections: 0 });

    const alice = await h.createClient({ name: "Alice", role: "sender" });
    const { body: bodyAfter } = await h.httpGet("/health");
    expect(bodyAfter).toMatchObject({ connections: 1 });

    alice.close();
    // give server time to process close
    await new Promise((r) => setTimeout(r, 100));
    const { body: bodyAfterClose } = await h.httpGet("/health");
    expect(bodyAfterClose).toMatchObject({ connections: 0 });
  });
});
