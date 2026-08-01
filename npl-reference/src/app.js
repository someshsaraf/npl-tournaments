import { fixtures, rosters, tournamentMeta } from "./data/tournament-data.js";

const STORAGE_KEY = "npl-2026-state-v1";
const tabs = [
  ["live", "Live Arena"],
  ["dashboard", "Dashboard"],
  ["schedule", "Schedule"],
  ["groups", "Groups"],
  ["results", "Results"],
  ["console", "Mobile Console"],
];

const state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const base = {
    activeTab: "live",
    activeMatchId: fixtures[0]?.id || "",
    youtubeUrl: tournamentMeta.youtubeUrl,
    streamEnabled: false,
    selectedDate: "all",
    selectedCategory: "all",
    selectedDashboardCategory: "all",
    selectedGroupCategory: "Team Championship",
    fixtures,
  };

  if (!saved) return base;

  try {
    const parsed = JSON.parse(saved);
    const mergedFixtures = fixtures.map((match) => ({
      ...match,
      ...(parsed.fixtures || []).find((item) => item.id === match.id),
    }));
    return { ...base, ...parsed, fixtures: mergedFixtures };
  } catch {
    return base;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setState(patch) {
  Object.assign(state, patch);
  saveState();
  render();
}

function getActiveMatch() {
  return state.fixtures.find((match) => match.id === state.activeMatchId) || state.fixtures[0];
}

function splitSides(matchText) {
  const clean = matchText.replace(/\s+/g, " ");
  const parts = clean.split(/\s+vs\s+/i);
  return {
    sideA: parts[0] || "Player / Team A",
    sideB: parts.slice(1).join(" vs ") || "Player / Team B",
  };
}

function getDisplaySides(match) {
  if (match.category === "Team Championship") {
    const parsed = parseTeamChampionship(match);
    return {
      sideA: match.entrantA || parsed.sideA,
      sideB: match.entrantB || parsed.sideB,
    };
  }
  const fallback = splitSides(match.match);
  return {
    sideA: match.entrantA || fallback.sideA,
    sideB: match.entrantB || fallback.sideB,
  };
}

function escapeAttr(value) {
  return String(value).replace(/"/g, "&quot;");
}

function unique(values) {
  return [...new Set(values)].filter(Boolean);
}

function flattenRoster(category) {
  return Object.values(rosters[category] || {}).flat();
}

function pairCombinations(players) {
  const pairs = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      pairs.push(`${players[i]} & ${players[j]}`);
    }
  }
  return pairs;
}

function parseTeamChampionship(match) {
  const { sideA, sideB } = splitSides(match.match);
  const matchNumber = Number(match.match.match(/\(Match\s+(\d+)\)/i)?.[1] || 1);
  return {
    sideA,
    sideB: sideB.replace(/\s+\(Match\s+\d+\)/i, ""),
    matchNumber,
    gameType: matchNumber === 1 ? "Singles" : "Doubles",
  };
}

function getGameType(match) {
  if (match.category === "Team Championship") return parseTeamChampionship(match).gameType;
  if (match.category.includes("Doubles")) return "Doubles";
  if (match.category.includes("Singles")) return "Singles";
  return "Match";
}

function getEntrantOptions(match, side) {
  if (match.category === "Team Championship") {
    const parsed = parseTeamChampionship(match);
    const teamName = side === "A" ? parsed.sideA : parsed.sideB;
    const players = rosters["Team Championship"]?.[teamName] || [];
    return parsed.gameType === "Doubles" ? pairCombinations(players) : players;
  }

  const options = flattenRoster(match.category);
  if (options.length) return options;

  const fallback = splitSides(match.match);
  return [side === "A" ? fallback.sideA : fallback.sideB];
}

function renderEntrantSelect(match, side) {
  const key = side === "A" ? "entrantA" : "entrantB";
  const fallback = splitSides(match.match);
  const fallbackLabel = side === "A" ? fallback.sideA : fallback.sideB;
  const options = getEntrantOptions(match, side);
  const selected = match[key] || "";

  return `
    <label class="lineup-select">
      <span>${side === "A" ? "Side A" : "Side B"}</span>
      <select data-lineup="${match.id}:${key}">
        <option value="">${fallbackLabel}</option>
        ${options.map((option) => `<option value="${option}" ${selected === option ? "selected" : ""}>${option}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderTrumpControls(match) {
  if (match.category !== "Team Championship") return `<span class="muted">-</span>`;
  const parsed = parseTeamChampionship(match);
  return `
    <div class="trump-controls">
      <label>
        <input type="checkbox" data-trump="${match.id}:trumpA" ${match.trumpA ? "checked" : ""} />
        ${parsed.sideA} trump
      </label>
      <label>
        <input type="checkbox" data-trump="${match.id}:trumpB" ${match.trumpB ? "checked" : ""} />
        ${parsed.sideB} trump
      </label>
    </div>
  `;
}

function getTrumpFlags(match) {
  if (match.category !== "Team Championship") return [];
  const parsed = parseTeamChampionship(match);
  const { sideA, sideB } = getDisplaySides(match);
  const flags = [];
  if (match.trumpA) flags.push({ team: parsed.sideA, entrant: sideA });
  if (match.trumpB) flags.push({ team: parsed.sideB, entrant: sideB });
  return flags;
}

function renderTrumpBanner(match) {
  const flags = getTrumpFlags(match);
  if (match.category !== "Team Championship") return "";
  return `
    <div class="trump-banner ${flags.length ? "is-live" : ""}">
      <span>Trump Game</span>
      ${
        flags.length
          ? flags.map((flag) => `<strong>${flag.team}: ${flag.entrant}</strong>`).join("")
          : `<strong>Not marked yet</strong>`
      }
    </div>
  `;
}

function calculateTeamStandings() {
  const standings = Object.keys(rosters["Team Championship"] || {}).map((team) => ({
    team,
    played: 0,
    won: 0,
    lost: 0,
    trumpWon: 0,
    trumpLost: 0,
    points: 0,
  }));
  const byTeam = Object.fromEntries(standings.map((row) => [row.team, row]));

  state.fixtures
    .filter((match) => match.category === "Team Championship" && (match.status === "Completed" || Number(match.scoreA) !== Number(match.scoreB)))
    .forEach((match) => {
      const parsed = parseTeamChampionship(match);
      const { sideA, sideB } = getDisplaySides(match);
      const scoreWinner = Number(match.scoreA) > Number(match.scoreB) ? sideA : Number(match.scoreB) > Number(match.scoreA) ? sideB : "";
      const effectiveWinner = match.winner || scoreWinner;
      const normalizedWinner = String(effectiveWinner).replace(/\s+\(Match\s+\d+\)/i, "");
      const winnerTeam =
        normalizedWinner === sideA || normalizedWinner === parsed.sideA
          ? parsed.sideA
          : normalizedWinner === sideB || normalizedWinner === parsed.sideB
            ? parsed.sideB
            : "";
      const loserTeam = winnerTeam === parsed.sideA ? parsed.sideB : parsed.sideA;
      if (!byTeam[winnerTeam] || !byTeam[loserTeam]) return;

      const winnerTrump = winnerTeam === parsed.sideA ? Boolean(match.trumpA) : Boolean(match.trumpB);
      const loserTrump = loserTeam === parsed.sideA ? Boolean(match.trumpA) : Boolean(match.trumpB);

      byTeam[winnerTeam].played += 1;
      byTeam[winnerTeam].won += 1;
      byTeam[winnerTeam].points += winnerTrump ? 2 : 1;
      if (winnerTrump) byTeam[winnerTeam].trumpWon += 1;

      byTeam[loserTeam].played += 1;
      byTeam[loserTeam].lost += 1;
      byTeam[loserTeam].points += loserTrump ? -1 : 0;
      if (loserTrump) byTeam[loserTeam].trumpLost += 1;
    });

  return standings.sort((a, b) => b.points - a.points || b.won - a.won || a.lost - b.lost || a.team.localeCompare(b.team));
}

function calculateCategoryStandings(category) {
  if (category === "Team Championship") return calculateTeamStandings();

  const rows = {};
  state.fixtures
    .filter((match) => match.category === category && (match.status === "Completed" || Number(match.scoreA) !== Number(match.scoreB)))
    .forEach((match) => {
      const { sideA, sideB } = getDisplaySides(match);
      const scoreWinner = Number(match.scoreA) > Number(match.scoreB) ? sideA : Number(match.scoreB) > Number(match.scoreA) ? sideB : "";
      const winner = match.winner || scoreWinner;
      if (!winner || Number(match.scoreA) === Number(match.scoreB)) return;
      const loser = winner === sideA ? sideB : sideA;

      [sideA, sideB].forEach((entrant) => {
        rows[entrant] ||= {
          team: entrant,
          played: 0,
          won: 0,
          lost: 0,
          points: 0,
          trumpWon: 0,
          trumpLost: 0,
        };
      });

      rows[winner].played += 1;
      rows[winner].won += 1;
      rows[winner].points += 1;
      rows[loser].played += 1;
      rows[loser].lost += 1;
    });

  return Object.values(rows).sort((a, b) => b.points - a.points || b.won - a.won || a.lost - b.lost || a.team.localeCompare(b.team));
}

function getCompletedCount(category) {
  return state.fixtures.filter((match) => match.category === category && match.status === "Completed").length;
}

function renderStandingCards(category, compact = false) {
  const standings = calculateCategoryStandings(category);
  if (!standings.length) return `<p class="muted empty-dashboard">No completed matches entered for ${category} yet.</p>`;

  return `
    <div class="standings-grid ${compact ? "compact-standings" : ""}">
      ${standings
        .map(
          (row, index) => `
            <article class="standing-card ${index < 2 ? "qualifier" : ""}">
              <span>Rank ${index + 1}</span>
              <h3>${row.team}</h3>
              <strong>${row.points}</strong>
              <p>Played ${row.played} | Won ${row.won} | Lost ${row.lost}</p>
              ${category === "Team Championship" ? `<small>Trump W ${row.trumpWon} | Trump L ${row.trumpLost}</small>` : `<small>Category points</small>`}
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDashboard() {
  const categories = unique(state.fixtures.map((match) => match.category));
  const selected = state.selectedDashboardCategory;
  const categoriesToShow = selected === "all" ? categories : [selected];
  const completedTotal = state.fixtures.filter((match) => match.status === "Completed").length;

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Tournament Dashboard</h2>
          <p class="muted">Overall and category-wise standings. Team Championship includes trump scoring.</p>
        </div>
        <select data-dashboard-category>
          <option value="all" ${selected === "all" ? "selected" : ""}>All categories</option>
          ${categories.map((category) => `<option value="${category}" ${selected === category ? "selected" : ""}>${category}</option>`).join("")}
        </select>
      </div>
      <div class="quick-stats dashboard-stats">
        <div><b>${state.fixtures.length}</b><span>Total fixtures</span></div>
        <div><b>${completedTotal}</b><span>Completed</span></div>
        <div><b>${categories.length}</b><span>Categories</span></div>
      </div>
      <div class="category-dashboard-list">
        ${categoriesToShow
          .map(
            (category) => `
              <section class="category-dashboard">
                <div class="category-dashboard-head">
                  <div>
                    <h3>${category}</h3>
                    <p>${getCompletedCount(category)} completed matches</p>
                  </div>
                  <span>${category === "Team Championship" ? "Trump scoring" : "Win = 1 point"}</span>
                </div>
                ${renderStandingCards(category, selected === "all")}
              </section>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderTeamStandingsDashboard() {
  const standings = calculateTeamStandings();
  return `
    <section class="standings-dashboard">
      <div class="section-head">
        <div>
          <h2>Team Championship Standings</h2>
          <p class="muted">Calculated from completed Team Championship games. Trump wins score 2 points; trump losses score -1.</p>
        </div>
      </div>
      <div class="standings-grid">
        ${standings
          .map(
            (row, index) => `
              <article class="standing-card ${index < 2 ? "qualifier" : ""}">
                <span>Rank ${index + 1}</span>
                <h3>${row.team}</h3>
                <strong>${row.points}</strong>
                <p>Played ${row.played} | Won ${row.won} | Lost ${row.lost}</p>
                <small>Trump W ${row.trumpWon} | Trump L ${row.trumpLost}</small>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function getScoringRule(match) {
  const isFinal = match.stage === "Final";
  const category = match.category;

  if (category === "Team Championship") {
    if (isFinal) {
      return {
        title: "Team Championship Final",
        target: "Race to 21",
        cap: "No deuce. At 21-21, next point wins.",
        note: "Five games decide the championship. Team with maximum match points wins.",
      };
    }
    return {
      title: "Team Championship Group Match",
      target: "Race to 15",
      cap: "No deuce. At 14-14, next point wins.",
      note: "Each game gives 1 point to the winner. Trump win gives 2 points; trump loss gives -1.",
    };
  }

  if (category.startsWith("Boys") || category.startsWith("Girls")) {
    return {
      title: "Kids Category",
      target: "Race to 15",
      cap: "Deuce from 14-14. Lead by 2. At 20-20, next point wins.",
      note: "Expected winner score: 15 to 21, depending on deuce.",
    };
  }

  if (category.startsWith("Women's")) {
    if (isFinal) {
      return {
        title: "Women's Final",
        target: "Single set, race to 21",
        cap: "Deuce from 20-20. Lead by 2. At 24-24, next point wins.",
        note: "Expected winner score: 21 to 25.",
      };
    }
    return {
      title: "Women's Pre-final Match",
      target: "Race to 15",
      cap: "Deuce from 14-14. Lead by 2. At 20-20, next point wins.",
      note: "Expected winner score: 15 to 21.",
    };
  }

  if (category.startsWith("Men's")) {
    if (isFinal) {
      return {
        title: "Men's Grand Final",
        target: "Best of 3 games, race to 21",
        cap: "Deuce from 20-20. Lead by 2. At 29-29, next point wins.",
        note: "Expected winner score per game: 21 to 30.",
      };
    }
    return {
      title: "Men's Pre-final Match",
      target: "Race to 21",
      cap: "Deuce from 20-20. Lead by 2. At 29-29, next point wins.",
      note: "Expected winner score: 21 to 30.",
    };
  }

  return {
    title: "Match Format",
    target: "Use referee guidance",
    cap: "Standard badminton service and court rules apply.",
    note: "Organisers can update the format note if needed.",
  };
}

function renderRuleCard(match, compact = false) {
  const rule = getScoringRule(match);
  return `
    <div class="rule-card ${compact ? "compact-rule" : ""}">
      <span>${rule.title}</span>
      <strong>${rule.target}</strong>
      <p>${rule.cap}</p>
      <small>${rule.note}</small>
    </div>
  `;
}

function filteredFixtures() {
  return state.fixtures.filter((match) => {
    const dateMatch = state.selectedDate === "all" || match.date === state.selectedDate;
    const categoryMatch = state.selectedCategory === "all" || match.category === state.selectedCategory;
    return dateMatch && categoryMatch;
  });
}

function formatDateLabel(date) {
  return date.replace("-26", " 2026");
}

function updateMatch(id, patch) {
  state.fixtures = state.fixtures.map((match) => (match.id === id ? { ...match, ...patch } : match));
  saveState();
  render();
}

function adjustScore(id, side, delta) {
  const match = state.fixtures.find((item) => item.id === id);
  if (!match) return;
  const key = side === "A" ? "scoreA" : "scoreB";
  updateMatch(id, { [key]: Math.max(0, Number(match[key] || 0) + delta), status: "Live" });
}

function completeActiveMatch(winner) {
  const active = getActiveMatch();
  updateMatch(active.id, { status: "Completed", winner });
}

function markFixtureWinner(id, winner) {
  const match = state.fixtures.find((item) => item.id === id);
  if (!match) return;
  updateMatch(id, {
    status: winner ? "Completed" : "Scheduled",
    winner,
  });
}

function resetDemoData() {
  localStorage.removeItem(STORAGE_KEY);
  Object.assign(state, loadState());
  render();
}

function appShell(content) {
  return `
    <header class="topbar">
      <div class="brand-lockup">
        <img class="npl-logo" src="./src/assets/npl-logo.jpeg" alt="Nature Walk Premier League Badminton logo" />
        <div>
        <p class="eyebrow">${tournamentMeta.eventName}</p>
        <h1>Badminton Live Portal</h1>
        </div>
      </div>
      <div class="status-pill">${state.fixtures.filter((m) => m.status === "Completed").length} results updated</div>
    </header>
    <nav class="tabs" aria-label="Main sections">
      ${tabs
        .map(
          ([id, label]) => `
            <button class="${state.activeTab === id ? "active" : ""}" data-tab="${id}">
              ${label}
            </button>
          `
        )
        .join("")}
    </nav>
    <main>${content}</main>
  `;
}

function renderLive() {
  const active = getActiveMatch();
  const { sideA, sideB } = getDisplaySides(active);
  const upcoming = state.fixtures.filter((match) => match.status === "Scheduled").slice(0, 5);
  const showStream = state.streamEnabled && state.youtubeUrl;

  return `
    <section class="live-grid">
      <div class="broadcast-frame">
        <div class="score-overlay">
          <div>
            <span>${active.category}</span>
            <strong>${active.date} ${active.time}</strong>
          </div>
          <div class="scoreline">
            <b>${sideA}</b>
            <em>${active.scoreA}</em>
            <span>:</span>
            <em>${active.scoreB}</em>
            <b>${sideB}</b>
          </div>
          <div class="match-state">${active.stage} | ${active.status}</div>
          ${renderTrumpBanner(active)}
          ${renderRuleCard(active, true)}
        </div>
        <div class="video-panel">
          ${
            showStream
              ? `<iframe src="${state.youtubeUrl}" title="NPL YouTube live feed" allowfullscreen></iframe>`
              : `<div class="stream-fallback">
                  <img src="./src/assets/npl-logo.jpeg" alt="Nature Walk Premier League Badminton logo" />
                  <span>Live stream offline</span>
                  <h2>Scores and schedule are still available</h2>
                  <p>YouTube streaming can be enabled again from the Mobile Console once the live feed resumes.</p>
                </div>`
          }
        </div>
      </div>
      <aside class="panel">
        <h2>Now Showing</h2>
        <p class="muted">${active.match}</p>
        ${renderRuleCard(active)}
        <div class="quick-stats">
          <div><b>${state.fixtures.length}</b><span>Fixtures</span></div>
          <div><b>${unique(state.fixtures.map((m) => m.category)).length}</b><span>Categories</span></div>
          <div><b>${unique(state.fixtures.map((m) => m.date)).length}</b><span>Days</span></div>
        </div>
        <h3>Next Matches</h3>
        <div class="stack">
          ${upcoming
            .map(
              (match) => `
                <button class="match-card compact" data-active-match="${match.id}">
                  <span>${match.time} | ${match.category}</span>
                  <strong>${match.match}</strong>
                </button>
              `
            )
            .join("")}
        </div>
      </aside>
    </section>
  `;
}

function renderSchedule() {
  const dates = ["all", ...unique(state.fixtures.map((match) => match.date))];
  const categories = ["all", ...unique(state.fixtures.map((match) => match.category))];
  const rows = filteredFixtures();

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Day-wise Schedule</h2>
          <p class="muted">Filter by day and category. Scores and winners can be updated here for matches already completed.</p>
        </div>
        <div class="filters">
          <select data-filter="date">${dates.map((date) => `<option value="${date}" ${date === state.selectedDate ? "selected" : ""}>${date === "all" ? "All dates" : formatDateLabel(date)}</option>`).join("")}</select>
          <select data-filter="category">${categories.map((category) => `<option value="${category}" ${category === state.selectedCategory ? "selected" : ""}>${category === "all" ? "All categories" : category}</option>`).join("")}</select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Time</th><th>Category</th><th>Stage</th><th>Match</th><th>Line-up</th><th>Trump</th><th>Rules</th><th>Score</th><th>Winner</th><th>Status</th></tr></thead>
          <tbody>
            ${rows
              .map((match) => {
                const { sideA, sideB } = getDisplaySides(match);
                const rule = getScoringRule(match);
                const gameType = getGameType(match);
                return `
                  <tr>
                    <td>${match.date}</td>
                    <td>${match.time}</td>
                    <td>${match.category}</td>
                    <td>${match.stage}</td>
                    <td>${match.match}</td>
                    <td>
                      <div class="lineup-cell">
                        <span class="game-type">${gameType}</span>
                        ${renderEntrantSelect(match, "A")}
                        ${renderEntrantSelect(match, "B")}
                      </div>
                    </td>
                    <td>${renderTrumpControls(match)}</td>
                    <td><button class="rule-chip" title="${escapeAttr(rule.cap)}" data-active-match="${match.id}">${rule.target}</button></td>
                    <td>
                      <div class="inline-score">
                        <input aria-label="${sideA} score" type="number" min="0" value="${match.scoreA}" data-inline-score="${match.id}:scoreA" />
                        <span>-</span>
                        <input aria-label="${sideB} score" type="number" min="0" value="${match.scoreB}" data-inline-score="${match.id}:scoreB" />
                      </div>
                    </td>
                    <td>
                      <select data-schedule-winner="${match.id}">
                        <option value="">Pending</option>
                        <option value="${sideA}" ${match.winner === sideA ? "selected" : ""}>${sideA}</option>
                        <option value="${sideB}" ${match.winner === sideB ? "selected" : ""}>${sideB}</option>
                      </select>
                    </td>
                    <td><span class="badge ${match.status.toLowerCase()}">${match.status}</span></td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderGroups() {
  const categories = Object.keys(rosters);
  const selected = rosters[state.selectedGroupCategory] || rosters[categories[0]];

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Group-wise Players</h2>
          <p class="muted">Players and pairs extracted from the shared tournament fixture document.</p>
        </div>
        <select data-group-category>
          ${categories.map((category) => `<option value="${category}" ${category === state.selectedGroupCategory ? "selected" : ""}>${category}</option>`).join("")}
        </select>
      </div>
      <div class="group-grid">
        ${Object.entries(selected)
          .map(
            ([group, players]) => `
              <article class="group-card">
                <h3>${group}</h3>
                <ul>${players.map((player) => `<li>${player}</li>`).join("")}</ul>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderResults() {
  const completed = state.fixtures.filter((match) => match.status === "Completed");
  const byCategory = unique(completed.map((match) => match.category)).map((category) => ({
    category,
    completed: completed.filter((match) => match.category === category).length,
  }));

  return `
    <section class="results-grid">
      <div class="panel">
        <h2>Results</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Fixture</th><th>Score</th><th>Winner</th></tr></thead>
            <tbody>
              ${
                completed.length
                  ? completed
                      .map(
                        (match) => {
                          const { sideA, sideB } = getDisplaySides(match);
                          return `
                          <tr>
                            <td><b>${match.category}</b><br /><span>${sideA} vs ${sideB}</span></td>
                            <td>${match.scoreA} - ${match.scoreB}</td>
                            <td>${match.winner || "Pending"}</td>
                          </tr>
                        `;
                        }
                      )
                      .join("")
                  : `<tr><td colspan="3" class="empty">No results submitted yet.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
      <aside class="panel">
        <h2>Progress By Category</h2>
        <div class="stack">
          ${byCategory.length ? byCategory.map((item) => `<div class="metric-row"><span>${item.category}</span><b>${item.completed}</b></div>`).join("") : `<p class="muted">Completed category summary will appear here.</p>`}
        </div>
      </aside>
    </section>
  `;
}

function renderConsole() {
  const active = getActiveMatch();
  const { sideA, sideB } = getDisplaySides(active);
  const dates = unique(state.fixtures.map((match) => match.date));
  const categories = unique(state.fixtures.map((match) => match.category));

  return `
    <section class="console-grid">
      <div class="panel scorer">
        <h2>Scorer Console</h2>
        <label>Active match
          <select data-active-select>
            ${state.fixtures.map((match) => `<option value="${match.id}" ${match.id === active.id ? "selected" : ""}>${match.date} ${match.time} | ${match.category} | ${match.match}</option>`).join("")}
          </select>
        </label>
        <div class="mobile-score">
          <div>
            <strong>${sideA}</strong>
            <span>${active.scoreA}</span>
            <button data-score="${active.id}:A:1">+1</button>
            <button data-score="${active.id}:A:-1">-1</button>
          </div>
          <div>
            <strong>${sideB}</strong>
            <span>${active.scoreB}</span>
            <button data-score="${active.id}:B:1">+1</button>
            <button data-score="${active.id}:B:-1">-1</button>
          </div>
        </div>
        ${renderRuleCard(active)}
        <div class="action-row">
          <button data-status="Live">Start / Resume</button>
          <button data-winner="${sideA}">Winner: A</button>
          <button data-winner="${sideB}">Winner: B</button>
        </div>
      </div>
      <div class="panel">
        <h2>Organiser Controls</h2>
        <div class="form-grid">
          <label>Date
            <select data-edit="date">${dates.map((date) => `<option value="${date}" ${date === active.date ? "selected" : ""}>${date}</option>`).join("")}</select>
          </label>
          <label>Time
            <input data-edit="time" value="${active.time}" />
          </label>
          <label>Category
            <select data-edit="category">${categories.map((category) => `<option value="${category}" ${category === active.category ? "selected" : ""}>${category}</option>`).join("")}</select>
          </label>
          <label>Stage
            <input data-edit="stage" value="${active.stage}" />
          </label>
          <label class="wide">Match details
            <input data-edit="match" value="${active.match}" />
          </label>
          <label class="wide">YouTube embed URL
            <input data-youtube value="${state.youtubeUrl}" />
          </label>
          <label class="toggle-row wide">
            <input type="checkbox" data-stream-enabled ${state.streamEnabled ? "checked" : ""} />
            Show YouTube live stream on resident screen
          </label>
          <label class="wide">Reschedule notes
            <textarea data-edit="notes">${active.notes || ""}</textarea>
          </label>
        </div>
        <div class="action-row">
          <button data-save-edits="${active.id}">Save Changes</button>
          <button data-status="Rescheduled">Mark Rescheduled</button>
          <button data-reset>Reset Demo Data</button>
        </div>
      </div>
    </section>
  `;
}

function render() {
  const views = {
    live: renderLive,
    dashboard: renderDashboard,
    schedule: renderSchedule,
    groups: renderGroups,
    results: renderResults,
    console: renderConsole,
  };
  document.querySelector("#app").innerHTML = appShell(views[state.activeTab]());
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => setState({ activeTab: button.dataset.tab }));
  });

  document.querySelectorAll("[data-active-match]").forEach((button) => {
    button.addEventListener("click", () => setState({ activeMatchId: button.dataset.activeMatch, activeTab: "live" }));
  });

  document.querySelectorAll("[data-filter]").forEach((input) => {
    input.addEventListener("change", () => setState({ [`selected${input.dataset.filter[0].toUpperCase()}${input.dataset.filter.slice(1)}`]: input.value }));
  });

  document.querySelector("[data-group-category]")?.addEventListener("change", (event) => {
    setState({ selectedGroupCategory: event.target.value });
  });

  document.querySelector("[data-dashboard-category]")?.addEventListener("change", (event) => {
    setState({ selectedDashboardCategory: event.target.value });
  });

  document.querySelector("[data-active-select]")?.addEventListener("change", (event) => {
    setState({ activeMatchId: event.target.value });
  });

  document.querySelectorAll("[data-score]").forEach((button) => {
    button.addEventListener("click", () => {
      const [id, side, delta] = button.dataset.score.split(":");
      adjustScore(id, side, Number(delta));
    });
  });

  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => updateMatch(getActiveMatch().id, { status: button.dataset.status }));
  });

  document.querySelectorAll("[data-winner]").forEach((button) => {
    button.addEventListener("click", () => completeActiveMatch(button.dataset.winner));
  });

  document.querySelector("[data-save-edits]")?.addEventListener("click", (event) => {
    const id = event.currentTarget.dataset.saveEdits;
    const patch = {};
    document.querySelectorAll("[data-edit]").forEach((input) => {
      patch[input.dataset.edit] = input.value;
    });
    const youtube = document.querySelector("[data-youtube]")?.value;
    state.youtubeUrl = youtube || "";
    state.streamEnabled = Boolean(document.querySelector("[data-stream-enabled]")?.checked);
    updateMatch(id, patch);
  });

  document.querySelectorAll("[data-inline-score]").forEach((input) => {
    input.addEventListener("change", () => {
      const [id, key] = input.dataset.inlineScore.split(":");
      const match = state.fixtures.find((item) => item.id === id);
      const patch = { [key]: Math.max(0, Number(input.value || 0)) };
      const nextMatch = { ...match, ...patch };
      const { sideA, sideB } = getDisplaySides(nextMatch);
      if (Number(nextMatch.scoreA) > Number(nextMatch.scoreB)) patch.winner = sideA;
      if (Number(nextMatch.scoreB) > Number(nextMatch.scoreA)) patch.winner = sideB;
      if (Number(nextMatch.scoreA) !== Number(nextMatch.scoreB)) patch.status = "Completed";
      updateMatch(id, patch);
    });
  });

  document.querySelectorAll("[data-schedule-winner]").forEach((input) => {
    input.addEventListener("change", () => markFixtureWinner(input.dataset.scheduleWinner, input.value));
  });

  document.querySelectorAll("[data-lineup]").forEach((input) => {
    input.addEventListener("change", () => {
      const [id, key] = input.dataset.lineup.split(":");
      const match = state.fixtures.find((item) => item.id === id);
      const patch = { [key]: input.value };
      if (match?.winner) {
        const nextMatch = { ...match, ...patch };
        const { sideA, sideB } = getDisplaySides(nextMatch);
        if (![sideA, sideB].includes(match.winner)) patch.winner = "";
      }
      updateMatch(id, patch);
    });
  });

  document.querySelectorAll("[data-trump]").forEach((input) => {
    input.addEventListener("change", () => {
      const [id, key] = input.dataset.trump.split(":");
      updateMatch(id, { [key]: input.checked });
    });
  });

  document.querySelector("[data-reset]")?.addEventListener("click", resetDemoData);
}

render();
