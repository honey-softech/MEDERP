import { describe, expect, it } from "vitest";
import { parseCurlOutput, postAskEvaJson } from "@/lib/messaging/askeva-http";

describe("AskEva HTTP client", () => {
  it("rejects an invalid URL", async () => {
    await expect(postAskEvaJson("not-a-url", {})).rejects.toThrow(/invalid/i);
  });

  it("reads the status curl appends after the body", () => {
    expect(parseCurlOutput('{"ok":true}\n__MEDERP_STATUS__:200')).toEqual({
      status: 200,
      text: '{"ok":true}',
    });
  });
});
