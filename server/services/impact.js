import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../data");
const STATS_FILE = path.join(DATA_DIR, "impact.json");

// Serialize writes so concurrent requests do not overwrite each other's counts.
let writeQueue = Promise.resolve();

// Track seen anonymous ID + country pairs in memory so impact.json stores only counts.
const seenCountryUsers = new Set();

function defaultCounts() {
  return {
    lettersExplained: 0,
    scamsFlagged: 0,
    helpfulYes: 0,
    helpfulNo: 0,
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
      helpfulYes: Number(parsed?.helpfulYes) || 0,
      helpfulNo: Number(parsed?.helpfulNo) || 0,
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

function summarizeFull(counts) {
  const totalRatings = counts.helpfulYes + counts.helpfulNo;
  const helpfulPercent = totalRatings > 0 ? Math.round((counts.helpfulYes / totalRatings) * 100) : 0;
  const countries = Object.entries(counts.countries)
    .map(([country, users]) => ({ country, users: Number(users) || 0 }))
    .filter((entry) => entry.users > 0)
    .sort((a, b) => b.users - a.users || a.country.localeCompare(b.country));

  return {
    lettersExplained: counts.lettersExplained,
    scamsFlagged: counts.scamsFlagged,
    countriesReached: countries.length,
    helpfulYes: counts.helpfulYes,
    helpfulNo: counts.helpfulNo,
    totalRatings,
    helpfulPercent,
    countries,
  };
}

export async function getImpactStats() {
  const counts = await readCounts();
  return summarize(counts);
}

export async function getFullStats() {
  const counts = await readCounts();
  return summarizeFull(counts);
}

// Store only aggregate numbers and country counts — never letter text, photos, or IPs.
export function recordAnalysis({ scamRisk, country, anonId = "", countCountryUser = true }) {
  const task = writeQueue.then(async () => {
    const counts = await readCounts();
    counts.lettersExplained += 1;

    if (scamRisk === "likely_scam") {
      counts.scamsFlagged += 1;
    }

    if (country && countCountryUser !== false) {
      let shouldCountUser = true;
      if (anonId) {
        const key = `${country}::${anonId}`;
        if (seenCountryUsers.has(key)) {
          shouldCountUser = false;
        } else {
          if (seenCountryUsers.size > 50000) {
            seenCountryUsers.clear();
          }
          seenCountryUsers.add(key);
        }
      }

      if (shouldCountUser) {
        counts.countries[country] = (Number(counts.countries[country]) || 0) + 1;
      }
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STATS_FILE, JSON.stringify(counts, null, 2), "utf8");
    return summarize(counts);
  });

  writeQueue = task.catch(() => {});
  return task;
}

export function recordFeedback({ helpful }) {
  const task = writeQueue.then(async () => {
    const counts = await readCounts();
    if (helpful) {
      counts.helpfulYes += 1;
    } else {
      counts.helpfulNo += 1;
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STATS_FILE, JSON.stringify(counts, null, 2), "utf8");
    return summarizeFull(counts);
  });

  writeQueue = task.catch(() => {});
  return task;
}
