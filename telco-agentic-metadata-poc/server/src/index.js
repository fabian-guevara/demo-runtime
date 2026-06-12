import "./config/env.js";
import cors from "cors";
import express from "express";
import router from "./routes.js";

const port = Number(process.env.PORT || 4002);
const clientPort = Number(process.env.CLIENT_PORT || 5177);
const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN || `http://127.0.0.1:${clientPort}`,
  `http://127.0.0.1:${clientPort}`,
  `http://localhost:${clientPort}`
]);

const app = express();

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
app.use(router);

app.use((error, _req, res, _next) => {
  console.error("[server] unhandled error", error.message);
  res.status(500).json({
    error: error.message
  });
});

app.listen(port, () => {
  console.log(`[server] agentic metadata planner listening on http://127.0.0.1:${port}`);
});
