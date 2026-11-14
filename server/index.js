import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import analyzeRouter from "./routes/analyze.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT) || 3000;

// Allow compressed phone photos up to 8 MB in JSON payloads.
app.use(express.json({ limit: "8mb" }));

// Serve static files from /client so one server handles both API and UI.
const clientDir = path.resolve(__dirname, "../client");
app.use(express.static(clientDir));

app.use("/api", analyzeRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Send all other routes to the main page.
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Plainly server listening on http://localhost:${PORT}`);
});
