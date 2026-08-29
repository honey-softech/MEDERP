import { createServer } from "node:http";
import next from "next";
import { attachRealtime } from "./src/lib/realtime-server";

const dev = process.env.NODE_ENV !== "production" && process.env.npm_lifecycle_event !== "start";
// Do not use process.env.HOSTNAME — Railway/Docker set it to the container id,
// and 0.0.0.0 breaks Next.js routing. Bind publicly; keep Next hostname local.
const hostname = "localhost";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  attachRealtime(httpServer);

  httpServer
    .once("error", (error) => {
      console.error(error);
      process.exit(1);
    })
    .listen(port, "0.0.0.0", () => {
      console.log(`> Ready on http://0.0.0.0:${port}`);
      void import("./src/lib/messaging").then(({ startOutboundMessageWorker }) => {
        startOutboundMessageWorker();
      });
      if (process.env.NODE_ENV === "production" && process.env.SKIP_DRUG_IMPORT !== "1") {
        void import("./src/lib/drug-catalog-import")
          .then(async ({ ensureDrugCatalog }) => {
            const { prisma } = await import("./src/lib/prisma");
            await ensureDrugCatalog(prisma);
          })
          .catch((error) => {
            console.error("Drug catalog ensure failed:", error);
          });
      }
    });
});
