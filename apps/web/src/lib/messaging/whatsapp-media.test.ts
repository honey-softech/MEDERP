import { describe, expect, it } from "vitest";
import { mediaUrlError, safePdfFilename, shouldPublishRemote } from "@/lib/messaging/whatsapp-media";

describe("AskEva media URL", () => {
  it("rejects localhost and private hosts", () => {
    expect(mediaUrlError("http://localhost:3000/api/public/whatsapp-media/abc")).toMatch(/localhost/);
    expect(mediaUrlError("http://127.0.0.1/file.pdf")).toMatch(/localhost/);
    expect(mediaUrlError("http://192.168.1.10/file.pdf")).toMatch(/private/);
    expect(mediaUrlError("not-a-url")).toMatch(/invalid/i);
  });

  it("allows a public http or https URL", () => {
    expect(mediaUrlError("http://18.61.210.135/api/public/whatsapp-media/abc")).toBeNull();
    expect(mediaUrlError("https://files.example.com/bill.pdf")).toBeNull();
  });

  it("publishes to the live host when this app is localhost", () => {
    const previous = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000";
    expect(shouldPublishRemote("http://18.61.210.135/api/public/whatsapp-media/abc")).toBe(true);
    process.env.NEXT_PUBLIC_API_URL = "http://18.61.210.135";
    expect(shouldPublishRemote("http://18.61.210.135/api/public/whatsapp-media/abc")).toBe(false);
    process.env.NEXT_PUBLIC_API_URL = previous;
  });

  it("keeps PDF filenames ASCII-safe", () => {
    expect(safePdfFilename('INV/VEL "01".PDF')).toBe("INV_VEL_01_.PDF");
    expect(safePdfFilename("receipt")).toBe("receipt.pdf");
  });
});
