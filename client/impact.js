const els = {
  statLetters: document.getElementById("statLetters"),
  statScams: document.getElementById("statScams"),
  statCountries: document.getElementById("statCountries"),
  statHelpful: document.getElementById("statHelpful"),
  statRatingsCount: document.getElementById("statRatingsCount"),
  countriesTableBody: document.getElementById("countriesTableBody"),
  lastUpdated: document.getElementById("lastUpdated"),
};

function renderCountriesTable(countries) {
  els.countriesTableBody.textContent = "";

  if (!countries || countries.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.className = "mono-muted";
    cell.textContent = "No country counts recorded yet.";
    row.appendChild(cell);
    els.countriesTableBody.appendChild(row);
    return;
  }

  for (const entry of countries) {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = entry.country;

    const countCell = document.createElement("td");
    countCell.className = "num-col";
    countCell.textContent = Number(entry.users || 0).toLocaleString();

    row.appendChild(nameCell);
    row.appendChild(countCell);
    els.countriesTableBody.appendChild(row);
  }
}

async function loadStats() {
  try {
    const res = await fetch("/api/stats", { cache: "no-store" });
    if (!res.ok) return;
    const stats = await res.json();

    els.statLetters.textContent = Number(stats.lettersExplained || 0).toLocaleString();
    els.statScams.textContent = Number(stats.scamsFlagged || 0).toLocaleString();
    els.statCountries.textContent = Number(stats.countriesReached || 0).toLocaleString();

    const totalRatings = Number(stats.totalRatings || 0);
    els.statHelpful.textContent = totalRatings > 0 ? `${Number(stats.helpfulPercent || 0)}%` : "—";
    els.statRatingsCount.textContent = `${totalRatings.toLocaleString()} ${
      totalRatings === 1 ? "rating" : "ratings"
    }`;

    renderCountriesTable(stats.countries);

    const now = new Date();
    els.lastUpdated.textContent = `Updated ${now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  } catch {
    els.lastUpdated.textContent = "Could not refresh right now";
  }
}

loadStats();
setInterval(loadStats, 30000);
