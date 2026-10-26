/* Old Gold RFC — renders the markdown files in /content into the page.
   Club admins never need to touch this file: edit the .md files instead. */

(function () {
  "use strict";

  // ---------- helpers ----------
  async function getText(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(path + " → HTTP " + res.status);
    return res.text();
  }

  function mdToHtml(md) {
    const html = window.marked.parse(md);
    return window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
  }

  function fail(el, err) {
    console.error(err);
    el.innerHTML = '<p class="muted">This section couldn’t load. Try refreshing the page.</p>';
  }

  // <div data-md="/content/home.md"></div>  →  rendered markdown
  async function renderMarkdownBlocks() {
    const blocks = document.querySelectorAll("[data-md]");
    await Promise.all(
      [...blocks].map(async (el) => {
        try {
          el.innerHTML = mdToHtml(await getText(el.dataset.md));
          el.removeAttribute("aria-busy");
        } catch (e) {
          fail(el, e);
        }
      })
    );
  }

  // ---------- fixtures ----------
  function parseDate(s) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function fmtDate(d) {
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  function parseResult(s) {
    const m = /^([WLD])\b\s*(\d+)\s*[-–]\s*(\d+)/i.exec((s || "").trim());
    return m ? { outcome: m[1].toUpperCase(), us: +m[2], them: +m[3] } : null;
  }

  // Pulls the season title, the table rows and any trailing notes out of fixtures.md
  function parseFixtures(md) {
    const lines = md.replace(/<!--[\s\S]*?-->/g, "").split("\n");
    const title = (lines.find((l) => /^#\s+/.test(l)) || "").replace(/^#\s+/, "").trim();
    const rows = [];
    const notes = [];
    let headerSeen = false;
    let tableEnded = false;
    // Column positions come from the header row, so columns can be added or reordered.
    // Defaults match the original Date | Opponent | Venue | Result layout.
    let col = { date: 0, opponent: 1, venue: 2, result: 3, kickoff: -1, location: -1 };

    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith("|")) {
        const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!headerSeen) {                                        // header row
          headerSeen = true;
          const find = (re) => cells.findIndex((c) => re.test(c));
          const pick = (re, fallback) => { const i = find(re); return i >= 0 ? i : fallback; };
          col = {
            date: pick(/^date/i, 0),
            opponent: pick(/^(opponent|match|vs)/i, 1),
            venue: pick(/^(venue|home)/i, 2),
            result: pick(/^(result|score)/i, 3),
            kickoff: find(/^(kick|time)/i),
            location: find(/^(location|address|field|where)/i),
          };
          continue;
        }
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
        const cell = (k) => (col[k] >= 0 ? cells[col[k]] || "" : "");
        const date = parseDate(cell("date"));
        if (!date) continue;
        rows.push({
          date,
          opponent: cell("opponent").replace(/\s*\*$/, ""),
          conditional: /\*$/.test(cell("opponent")),
          venue: cell("venue"),
          kickoff: cell("kickoff"),
          location: cell("location"),
          resultText: cell("result"),
          result: parseResult(cell("result")),
        });
      } else if (headerSeen && line) {
        tableEnded = true;
      }
      if (tableEnded && line && !line.startsWith("|")) notes.push(line);
    }
    rows.sort((a, b) => a.date - b.date);
    return { title, rows, notes: notes.join("\n") };
  }

  function summarize(rows) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const played = rows.filter((r) => r.result);
    const rec = { W: 0, L: 0, D: 0 };
    played.forEach((r) => rec[r.result.outcome]++);
    return {
      record: rec,
      played: played.length,
      last: played[played.length - 1] || null,
      next: rows.find((r) => !r.result && r.date >= today) || null,
    };
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const venueLabel = (v) => (/^away$/i.test(v) ? "@" : "vs");
  // "vs Boston" / "@ Boston", but just "Playoffs" for if-we-qualify placeholder rows
  const matchName = (r) => (r.conditional ? esc(r.opponent) : `${venueLabel(r.venue)} ${esc(r.opponent)}`);
  const outcomeWord = { W: "Win", L: "Loss", D: "Draw" };
  const mapLink = (loc) =>
    `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(loc)}" target="_blank" rel="noopener">${esc(loc)}</a>`;

  function resultBadge(r) {
    if (!r.result) return r.resultText ? `<span class="badge">${esc(r.resultText)}</span>` : "";
    const o = r.result.outcome;
    return `<span class="badge badge-${o}" title="${outcomeWord[o]}">${o} ${r.result.us}–${r.result.them}</span>`;
  }

  // Home page: next match / last result / record
  function renderSeasonCards(el, data) {
    const s = summarize(data.rows);
    const next = s.next
      ? `<p class="card-big">${matchName(s.next)}</p>
         <p class="muted">${fmtDate(s.next.date)}${s.next.kickoff ? " · " + esc(s.next.kickoff) : ""} · ${esc(s.next.venue)}${s.next.conditional ? " · if we qualify" : ""}</p>
         ${s.next.location ? `<p class="muted card-loc">${mapLink(s.next.location)}</p>` : ""}`
      : `<p class="card-big">Season complete</p><p class="muted">See you next season</p>`;
    const last = s.last
      ? `<p class="card-big">${resultBadge(s.last)}</p>
         <p class="muted">${matchName(s.last)} · ${fmtDate(s.last.date)}</p>`
      : `<p class="card-big">—</p><p class="muted">No results posted yet</p>`;
    const r = s.record;
    const record = s.played
      ? `<p class="card-big">${r.W}–${r.L}${r.D ? "–" + r.D : ""}</p>
         <p class="muted">${esc(data.title || "This season")}${r.D ? " · W–L–D" : " · W–L"}</p>`
      : `<p class="card-big">—</p><p class="muted">${esc(data.title || "This season")}</p>`;

    el.innerHTML = `
      <article class="card"><h3>Next match</h3>${next}</article>
      <article class="card"><h3>Last result</h3>${last}</article>
      <article class="card"><h3>Record</h3>${record}</article>`;
    el.removeAttribute("aria-busy");
  }

  // Fixtures page: full list
  function renderFixtureList(el, data) {
    const s = summarize(data.rows);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items = data.rows
      .map((r) => {
        const isNext = s.next && r === s.next;
        const isPast = r.date < today;
        const iso = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}-${String(r.date.getDate()).padStart(2, "0")}`;
        const fallback = isNext ? '<span class="badge badge-next">Next</span>' : isPast ? '<span class="badge badge-tba">Score TBA</span>' : "";
        return `<li class="fixture${isNext ? " is-next" : ""}${r.result ? " is-played" : ""}">
          <time datetime="${iso}">${fmtDate(r.date)}</time>
          <span class="opp">${matchName(r)}${r.conditional ? "<sup>*</sup>" : ""}${
            r.kickoff || r.location
              ? `<small class="meta">${[r.kickoff && esc(r.kickoff), r.location && mapLink(r.location)].filter(Boolean).join(" · ")}</small>`
              : ""
          }</span>
          <span class="venue">${esc(r.venue)}</span>
          <span class="res">${resultBadge(r) || fallback}</span>
        </li>`;
      })
      .join("");
    el.innerHTML = `
      <h1>${esc(data.title || "Fixtures")}</h1>
      <ol class="fixtures">${items}</ol>
      ${data.notes ? `<div class="notes">${mdToHtml(data.notes)}</div>` : ""}`;
    el.removeAttribute("aria-busy");
  }

  async function renderFixtures() {
    const cards = document.querySelector("[data-season-cards]");
    const list = document.querySelector("[data-fixture-list]");
    if (!cards && !list) return;
    try {
      const data = parseFixtures(await getText("/content/fixtures.md"));
      if (cards) renderSeasonCards(cards, data);
      if (list) renderFixtureList(list, data);
    } catch (e) {
      if (cards) fail(cards, e);
      if (list) fail(list, e);
    }
  }

  // ---------- boot ----------
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  renderMarkdownBlocks();
  renderFixtures();
})();
