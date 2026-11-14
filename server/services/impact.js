import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../data");
const STATS_FILE = path.join(DATA_DIR, "impact.json");

// Serialize writes so concurrent requests do not overwrite each other's counts.
let writeQueue = Promise.resolve();

function defaultCounts() {
  return {
    lettersExplained: 0,
    scamsFlagged: 0,
    countries: {},
  };
}

async function readCounts() {
  try {
    const raw = await fs.readFile(STATS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      lettersExplained: Number(parsed?.lettersExplained) || 0,
      scamsFlagged: Number(parsed?.scamsFlagged) || 0,
      countries: parsed?.countries && typeof parsed.countries === "object" ? parsed.countries : {},
    };
  } catch (err) {
    if (err?.code === "ENOENT") {
      return defaultCounts();
    }
    return defaultCounts();
  }
}

function summarize(counts) {
  return {
    lettersExplained: counts.lettersExplained,
    scamsFlagged: counts.scamsFlagged,
    countriesReached: Object.keys(counts.countries).length,
  };
}

export async function getImpactStats() {
  const counts = await readCounts();
  return summarize(counts);
}

// Store only aggregate numbers and country counts — never letter text or photos.
export function recordAnalysis({ scamRisk, country }) {
  const task = writeQueue.then(async () => {
    const counts = await readCounts();
    counts.lettersExplained += 1;

    if (scamRisk === "likely_scam") {
      counts.scamsFlagged += 1;
    }

    if (country) {
      counts.countries[country] = (Number(counts.countries[country]) || 0) + 1;
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STATS_FILE, JSON.stringify(counts, null, 2), "utf8");
    return summarize(counts);
  });

  writeQueue = task.catch(() => {});
  return task;
}
