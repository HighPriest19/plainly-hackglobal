import { Router } from "express";
import { analyzeWithGemini } from "../services/gemini.js";
import { getImpactStats, recordAnalysis } from "../services/impact.js";

const router = Router();

const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
// Protects the API key from abuse by capping requests per IP.
const requestCounts = new Map();

function isRateLimited(ip) {
  const now = Date.now();

  // Clear expired entries so old IPs do not build up in memory.
  for (const [key, entry] of requestCounts.entries()) {
    if (now - entry.windowStart >= RATE_WINDOW_MS) {
      requestCounts.delete(key);
    }
  }

  const current = requestCounts.get(ip);
  if (!current) {
    requestCounts.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  current.count += 1;
  return false;
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 15000);
}

function cleanLanguage(value) {
  if (typeof value !== "string") return "English";
  const trimmed = value.trim().slice(0, 40);
  return trimmed || "English";
}

function cleanCountry(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().replace(/[^a-zA-Z\s'-]/g, "").slice(0, 60);
  return cleaned;
}

router.get("/impact", async (_req, res) => {
  try {
    const stats = await getImpactStats();
    return res.json(stats);
  } catch (err) {
    console.error("Impact route error:", err?.message || err);
    return res.json({ lettersExplained: 0, scamsFlagged: 0, countriesReached: 0 });
  }
});

// Accept either pasted text, a base64 image, or both in one request.
router.post("/analyze", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        error: "Rate limit reached (30 checks per 10 minutes). Please wait a few minutes and try again.",
      });
    }

    const text = cleanText(req.body?.text);
    const language = cleanLanguage(req.body?.language);
    const country = cleanCountry(req.body?.country);
    const imageBase64 = typeof req.body?.imageBase64 === "string" ? req.body.imageBase64 : "";
    const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "";

    if (!text && !imageBase64) {
      return res.status(400).json({
        error: "Please upload a photo or paste some text first.",
      });
    }

    if (imageBase64 && !ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return res.status(400).json({
        error: "Please upload a JPG, PNG, or WebP photo.",
      });
    }

    const result = await analyzeWithGemini({
      text,
      imageBase64,
      mimeType,
      language,
    });

    try {
      await recordAnalysis({ scamRisk: result.scamRisk, country });
    } catch (statsErr) {
      console.error("Failed to save impact count:", statsErr?.message || statsErr);
    }

    return res.json(result);
  } catch (err) {
    console.error("Analyze route error:", err?.message || err);

    const rawMsg = String(err?.message || "");
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    let message = "Could not read this document right now. Please try again.";

    if (!process.env.GEMINI_API_KEY) {
      message = "Server API key is not configured yet.";
    } else if (rawMsg.includes("API_KEY_INVALID") || status === 403) {
      message = "Server API key is invalid or unauthorized.";
    } else if (status === 429) {
      message = "The analysis service is busy right now. Please wait a moment and try again.";
    }

    return res.status(status).json({ error: message });
  }
});

export default router;
