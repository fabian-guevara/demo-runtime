import express from "express";
import cors from "cors";
import env from "./config/env.js";
import demosRoutes from "./routes/demos.routes.js";
import credentialsRoutes from "./routes/credentials.routes.js";
import telemetryRoutes from "./routes/telemetry.routes.js";
import clusterRoutes from "./routes/cluster.routes.js";
import integrationsRoutes from "./routes/integrations.routes.js";
import logger from "./utils/logger.js";

const app = express();
const allowedOrigins = new Set([
  env.webOrigin,
  `http://localhost:${env.webPort}`,
  `http://127.0.0.1:${env.webPort}`
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin '${origin}' is not allowed by CORS.`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true
  });
});

app.use((req, _res, next) => {
  logger.debug(`HTTP ${req.method} ${req.path}`);
  next();
});

app.use("/api/demos", demosRoutes);
app.use("/api/credentials", credentialsRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/clusters", clusterRoutes);
app.use("/api", integrationsRoutes);

app.use((error, _req, res, _next) => {
  logger.error("Unhandled API error", {
    message: error.message
  });

  res.status(500).json({
    error: error.message
  });
});

app.listen(env.apiPort, () => {
  logger.info("Demo runtime API listening", {
    port: env.apiPort,
    webOrigin: env.webOrigin
  });
});
