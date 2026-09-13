import { describe, expect, it } from "vitest";
import { postAskEvaJson } from "@/lib/messaging/askeva-http";

describe("AskEva HTTP client", () => {
  it("rejects an invalid URL", async () => {
    await expect(postAskEvaJson("not-a-url", {})).rejects.toThrow(/invalid/i);
  });
});
