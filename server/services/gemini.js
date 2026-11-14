import { GoogleGenAI, Type } from "@google/genai";

// Keep one shared client instance on the server so the key never reaches the browser.
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("Server is missing GEMINI_API_KEY in .env");
    err.status = 500;
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const VALID_RISKS = new Set(["safe", "suspicious", "likely_scam"]);

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    documentType: {
      type: Type.STRING,
      description: "Short label for the document, like Utility Bill, Bank SMS, or Parking Ticket.",
    },
    whatItWants: {
      type: Type.STRING,
      description: "One or two simple sentences explaining what the sender is asking the reader to do, written in the requested language.",
    },
    deadline: {
      type: Type.STRING,
      description: "Specific due date or timeframe if mentioned, or 'None stated' translated into the requested language.",
    },
    amount: {
      type: Type.STRING,
      description: "Money amount mentioned if any, or 'None stated' translated into the requested language.",
    },
    scamRisk: {
      type: Type.STRING,
      enum: ["safe", "suspicious", "likely_scam"],
      description: "Scam risk rating: safe, suspicious, or likely_scam.",
    },
    redFlags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of specific scam warning signs or pressure tactics found, written in the requested language. Empty array if safe.",
    },
    nextSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2 to 4 clear, practical next steps for the user, written in the requested language.",
    },
    plainExplanation: {
      type: Type.STRING,
      description: "Warm, plain-language explanation of the entire message with no jargon, written in the requested language and easy to listen to aloud.",
    },
    confusingPhrases: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Up to 5 exact short phrases quoted verbatim from the original document that are confusing, urgent, or suspicious so they can be highlighted.",
    },
  },
  required: [
    "documentType",
    "whatItWants",
    "deadline",
    "amount",
    "scamRisk",
    "redFlags",
    "nextSteps",
    "plainExplanation",
    "confusingPhrases",
  ],
};

function buildPrompt(language, text) {
  const lines = [
    "You help everyday people understand confusing letters, bills, and text messages.",
    `Write all explanatory fields (documentType, whatItWants, deadline, amount, redFlags, nextSteps, plainExplanation) in ${language}.`,
    'When the language is "Nigerian Pidgin", write in natural Nigerian Pidgin English that everyday people actually speak.',
    "Keep scamRisk strictly as one of: safe, suspicious, likely_scam.",
    "For confusingPhrases, copy up to 5 short exact phrases directly from the original document as written (do not translate confusingPhrases).",
    "Be calm, direct, and easy to understand at a 6th-grade reading level.",
    "Check carefully for common scam signals: fake urgency, strange links, requests for gift cards/crypto/wire transfers, mismatched sender names, threats of arrest or instant account closure.",
  ];

  if (text) {
    lines.push("", "Here is the message text:", text);
  } else {
    lines.push("", "Read the attached document photo carefully and analyze its contents.");
  }

  return lines.join("\n");
}

function normalizeResult(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const risk = VALID_RISKS.has(obj.scamRisk) ? obj.scamRisk : "suspicious";

  const redFlags = Array.isArray(obj.redFlags)
    ? obj.redFlags.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];

  const nextSteps = Array.isArray(obj.nextSteps)
    ? obj.nextSteps.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
    : [];

  if (nextSteps.length === 0) {
    nextSteps.push(
      "Verify the sender through an official phone number or website before replying or paying."
    );
  }

  return {
    documentType: String(obj.documentType || "").trim() || "Document",
    whatItWants:
      String(obj.whatItWants || "").trim() ||
      "Review this message carefully to confirm what action is being requested.",
    deadline: String(obj.deadline || "").trim() || "None stated",
    amount: String(obj.amount || "").trim() || "None stated",
    scamRisk: risk,
    redFlags,
    nextSteps,
    plainExplanation:
      String(obj.plainExplanation || "").trim() ||
      "We could not generate a full summary. Please check the sender through an official channel before sharing details or sending money.",
    confusingPhrases: Array.isArray(obj.confusingPhrases)
      ? obj.confusingPhrases.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
      : [],
  };
}

function parseJsonReply(rawText) {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Could not parse analysis JSON");
  }
}

// Sends one request to Gemini and returns structured JSON for the letter or photo.
export async function analyzeWithGemini({ text, imageBase64, mimeType, language }) {
  const ai = getClient();
  const parts = [];

  if (imageBase64 && mimeType) {
    parts.push({
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    });
  }

  parts.push({
    text: buildPrompt(language, text),
  });

  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: { parts },
    config: {
      systemInstruction:
        "You translate confusing official letters, bills, and SMS messages into plain language and flag scams. Return valid JSON only.",
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const rawText = (response.text || "").trim();
  if (!rawText) {
    throw new Error("Empty response from analysis service");
  }

  const parsed = parseJsonReply(rawText);
  return normalizeResult(parsed);
}
