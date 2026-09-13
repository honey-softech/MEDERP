import https from "node:https";

export type AskEvaHttpResult = { status: number; text: string };

/** HTTP/1.1 over IPv4. Node fetch/HTTP2 on EC2 was failing TLS to AskEva. */
export function postAskEvaJson(urlString: string, body: unknown): Promise<AskEvaHttpResult> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      reject(new Error("AskEva URL is invalid."));
      return;
    }
    const payload = Buffer.from(JSON.stringify(body));
    const req = https.request(
      {
        protocol: "https:",
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        family: 4,
        servername: url.hostname,
        minVersion: "TLSv1.2",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.byteLength),
          Accept: "application/json",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.setTimeout(20_000, () => {
      req.destroy(new Error("AskEva request timed out."));
    });
    req.on("error", reject);
    req.end(payload);
  });
}
