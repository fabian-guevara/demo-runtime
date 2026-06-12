import cors from "cors";
import express from "express";
import env from "./config/env.js";
import routes from "./routes.js";

const app = express();
const allowedOrigins = new Set([
  env.clientOrigin,
  `http://127.0.0.1:${env.clientPort}`,
  `http://localhost:${env.clientPort}`
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      try {
        const { hostname } = new URL(origin);
        if (hostname === "localhost" || hostname === "127.0.0.1") {
          callback(null, true);
          return;
        }
      } catch {
        // fall through
      }

      callback(new Error(`Origin ${origin} is not allowed.`));
    }
  })
);
app.use(express.json({ limit: "2mb" }));
app.use("/api", routes);

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message });
});

app.listen(env.port, () => {
  console.log("[api] customer-360 listening", {
    port: env.port,
    clientOrigin: env.clientOrigin,
    llmModel: env.groveModel
  });
});
