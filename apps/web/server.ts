import { createServer } from "node:http";
import next from "next";
import { attachRealtime } from "./src/lib/realtime-server";

const dev = process.env.NODE_ENV !== "production" && process.env.npm_lifecycle_event !== "start";
const hostname = process.env.HOSTNAME ?? "localhost";
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
      console.log(`> Ready on http://localhost:${port}`);
    });
});
