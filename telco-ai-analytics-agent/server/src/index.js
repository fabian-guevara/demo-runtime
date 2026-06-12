import cors from "cors";
import express from "express";
import env from "./config/env.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import demoRoutes from "./routes/demo.routes.js";
import healthRoutes from "./routes/health.routes.js";
import memoryRoutes from "./routes/memory.routes.js";
import logger from "./utils/logger.js";

const app = express();
const allowedOrigins = new Set([
  env.clientOrigin,
  `http://127.0.0.1:${env.clientPort}`,
  `http://localhost:${env.clientPort}`
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed.`));
    }
  })
);
app.use(express.json({ limit: "2mb" }));

app.use("/health", healthRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/demo", demoRoutes);

app.use((error, _req, res, _next) => {
  logger.error("Unhandled API error", {
    message: error.message
  });

  res.status(500).json({
    error: error.message
  });
});

app.listen(env.port, () => {
  logger.info("Telco AI analytics agent API listening", {
    port: env.port,
    clientOrigin: env.clientOrigin
  });
});
