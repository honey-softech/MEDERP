import { readFileSync } from "fs";
import https from "https";

const env = Object.fromEntries(
  readFileSync(new URL("./.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      const value = line.slice(index + 1).trim().replace(/^"|"$/g, "");
      return [line.slice(0, index), value];
    }),
);

const token = env.ASKEVA_API_TOKEN || env.WHATSAPP_ACCESS_TOKEN;
const base = (env.ASKEVA_API_URL || "https://backend.askeva.io/v1").replace(/\/$/, "");
console.log("tokenLen", token ? token.length : 0);
console.log("tokenMod16", token ? token.length % 16 : "none");
console.log("baseHost", new URL(base).host);

const body = JSON.stringify({
  to: "910000000000",
  type: "template",
  template: {
    language: { policy: "deterministic", code: "en" },
    name: "appointment_reminder1",
    components: [],
  },
});

const url = new URL(`${base}/message/send-message?token=${encodeURIComponent(token)}`);
const req = https.request(
  {
    protocol: "https:",
    hostname: url.hostname,
    port: 443,
    path: `${url.pathname}${url.search}`,
    method: "POST",
    family: 4,
    servername: url.hostname,
    minVersion: "TLSv1.2",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      Accept: "application/json",
    },
  },
  (res) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      console.log("status", res.statusCode);
      console.log("body", text.slice(0, 800));
    });
  },
);
req.setTimeout(20000, () => {
  console.error("timeout");
  req.destroy();
});
req.on("error", (error) => {
  console.error("ERR", error.code);
  console.error(String(error.message).slice(0, 500));
});
req.end(body);
