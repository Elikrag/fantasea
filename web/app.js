const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
const api = (p) => fetch(`/api${p}`).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (c, v) => v == null ? "—" : c === "SV%" ? Number(v).toFixed(3).replace(/^0/, "") : c === "GAA" ? Number(v).toFixed(2) : v;
const LOWER = new Set(["GAA"]);
const SK_CATS = ["G", "A", "P", "+/-", "PPP", "SOG", "HIT"];
const G_CATS = ["W", "GAA", "SV%", "SO"];

let league = null;
const watch = new Set(JSON.parse(localStorage.getItem("fantasea.watch") || "[]"));
const saveWatch = () => localStorage.setItem("fantasea.watch", JSON.stringify([...watch]));

/* ---------- shared ---------- */
function posTag(p) { return `<span class="pos ${p === "G" ? "g" : ""}">${esc(p)}</span>`; }
function tonight(p) { return p.tonight ? `<span class="tonight">${esc(p.tonight)}</span>` : `<span class="off">—</span>`; }
function status(p) { return `<span class="status ${p.status === "OK" ? "ok" : ""}">${p.status === "OK" ? "" : esc(p.status)}</span>`; }

function playerTable(rows, cats, { extra = [], dim = false } = {}) {
  if (!rows.length) return `<div class="empty">Nothing here</div>`;
  const head = ["", "Player", "Team", "Tonight", "GP", ...cats, ...extra.map((e) => e.h), ""].map((h, i) =>
    `<th class="${i >= 4 && i < 5 + cats.length ? "r" : ""}">${esc(h)}</th>`).join("");
  const body = rows.map((p) => `<tr class="${dim ? "muted" : ""}">
    <td>${posTag(p.pos)}</td>
    <td>${esc(p.name)}</td>
    <td class="muted">${esc(p.team)}</td>
    <td>${tonight(p)}</td>
    <td class="r">${p.gp_week ?? "—"}</td>
    ${cats.map((c) => `<td class="r">${fmt(c, p.stats?.[c])}</td>`).join("")}
    ${extra.map((e) => `<td>${e.f(p)}</td>`).join("")}
    <td>${status(p)}</td></tr>`).join("");
  return `<div class="scroll"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* ---------- team ---------- */
async function renderTeam() {
  const t = await api("/team");
  const idleActive = t.skaters.filter((p) => !p.tonight).length;
  const benchPlaying = t.bench.filter((p) => p.tonight).length;
  view.innerHTML = `
  <div class="head">
    <div class="stack">
      <h2>My team</h2>
      <h1>${esc(t.name)}</h1>
      <div class="sub">${esc(t.record)}${t.rank ? ` · ${t.rank}${ord(t.rank)} of ${league.teams}` : ""}${t.manager ? ` · ${esc(t.manager)}` : ""}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${t.games_left ?? "—"}</b><span>games left</span></div>
      <div class="kpi"><b>${t.active_tonight ?? "—"}<span style="color:var(--dim)">/${t.slots}</span></b><span>active tonight</span></div>
      <div class="kpi"><b class="${t.injured ? "flag" : ""}">${t.injured}</b><span>injured</span></div>
    </div>
  </div>
  <section class="section">
    <div class="row"><h2>Skaters</h2><span class="sub end">last 7 days</span></div>
    <div class="card">${playerTable(t.skaters, SK_CATS)}</div>
  </section>
  <section class="section">
    <div class="row"><h2>Goalies</h2></div>
    <div class="card">${playerTable(t.goalies, G_CATS, { extra: [{ h: "Start", f: (p) => p.start ? `<span class="${p.start === "Confirmed" ? "" : "muted"}">${esc(p.start)}</span>` : `<span class="off">—</span>` }] })}</div>
  </section>
  <section class="section">
    <div class="row"><h2>Bench &amp; IR</h2>
      ${benchPlaying && idleActive ? `<span class="sub end flag">${benchPlaying} bench player${benchPlaying > 1 ? "s" : ""} play tonight while ${idleActive} active slot${idleActive > 1 ? "s are" : " is"} idle</span>` : ""}</div>
    <div class="card">${playerTable([...t.bench, ...t.ir], SK_CATS, { dim: true })}</div>
  </section>`;
}
const ord = (n) => ["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] ?? "th";

/* ---------- matchup ---------- */
async function renderMatchup(week) {
  const m = await api(`/matchup${week ? `?week=${week}` : ""}`);
  const lead = m.cats.filter((c) => c.result === "W").length;
  const oppLead = m.cats.filter((c) => c.result === "L").length;
  const catRows = m.cats.map((c) => {
    const a = +c.me, b = +c.opp;
    let pct = a + b ? (a / (a + b)) * 100 : 50;
    if (LOWER.has(c.cat)) pct = 100 - pct;
    const cls = c.result === "W" ? "" : c.result === "L" ? "lose" : "tie";
    const margin = c.result === "T" ? "—" : fmtMargin(c.cat, a - b);
    return `<tr>
      <td><b>${esc(c.cat)}</b></td>
      <td class="r">${fmt(c.cat, a)}</td>
      <td><div class="bar"><i class="${cls}" style="width:${pct.toFixed(1)}%"></i></div></td>
      <td class="r muted">${fmt(c.cat, b)}</td>
      <td class="r ${c.result === "L" ? "flag" : "muted"}">${margin}</td>
      <td><span class="res ${c.result}">${c.result}</span></td></tr>`;
  }).join("");
  view.innerHTML = `
  <div class="row">
    <h2>Week ${m.week}${m.start ? ` · ${dateRange(m.start, m.end)}` : ""}</h2>
    <div class="row end" style="gap:6px">
      <button class="btn" data-week="${m.week - 1}">←</button>
      <button class="btn" data-week="${m.week + 1}">→</button>
    </div>
  </div>
  <div class="versus">
    <div class="side">
      <h2>You</h2><div class="name">${esc(m.me.name)}</div>
      <div class="sub">${esc(m.me.record)}${m.me.rank ? ` · ${m.me.rank}${ord(m.me.rank)}` : ""}</div>
      <div class="big">${lead}</div><div class="sub">categories</div>
    </div>
    <div class="center">
      <div class="score">${m.score.w}<i>·</i>${m.score.l}<i>·</i>${m.score.t}</div>
      <div class="sub">W · L · T</div>
      <div class="sub" style="margin-top:8px">${m.me.games_left ?? "—"} games left · opp ${m.opp.games_left ?? "—"}</div>
    </div>
    <div class="side right">
      <h2>Opponent</h2><div class="name">${esc(m.opp.name)}</div>
      <div class="sub">${esc(m.opp.record)}${m.opp.rank ? ` · ${m.opp.rank}${ord(m.opp.rank)}` : ""}</div>
      <div class="big" style="color:var(--muted)">${oppLead}</div><div class="sub">categories</div>
    </div>
  </div>
  <section class="section">
    <div class="row"><h2>Categories</h2><span class="sub end">bar shows your share of the combined total</span></div>
    <div class="card"><div class="scroll"><table class="tbl">
      <thead><tr><th>Cat</th><th class="r">You</th><th style="width:40%"></th><th class="r">Opp</th><th class="r">Margin</th><th></th></tr></thead>
      <tbody>${catRows || `<tr><td colspan="6" class="empty">No scoreboard data yet</td></tr>`}</tbody></table></div></div>
  </section>
  ${m.schedule.length ? `<section class="section">
    <div class="row"><h2>Games this week</h2><span class="sub end">you <em style="color:var(--dim)">·</em> opp</span></div>
    <div class="card"><div class="sched">${m.schedule.map((d) => `<div class="day ${d.opp - d.me >= 2 ? "warn" : ""}"><span>${esc(d.day)}</span><b>${d.me}<em>·</em>${d.opp}</b></div>`).join("")}</div></div>
  </section>` : ""}`;
  view.querySelectorAll("[data-week]").forEach((b) => b.onclick = () => renderMatchup(+b.dataset.week));
}
const fmtMargin = (c, d) => (d > 0 ? "+" : "") + (c === "SV%" ? d.toFixed(3) : c === "GAA" ? d.toFixed(2) : d);
const dateRange = (a, b) => { const o = { month: "short", day: "numeric" }; return `${new Date(a).toLocaleDateString(undefined, o)} – ${new Date(b).toLocaleDateString(undefined, o)}`; };

/* ---------- free agents ---------- */
const faState = { pos: "ALL", q: "", tonight: false, rows: [] };
async function renderFA() {
  faState.rows = await api(`/free-agents?pos=${faState.pos}`);
  view.innerHTML = `
  <section class="section" id="watchSec"></section>
  <section class="section">
    <div class="row">
      <h2>Available</h2>
      <div class="filters end">
        <input class="search" placeholder="Search players" value="${esc(faState.q)}">
        <div class="seg" id="posSeg">${["ALL", "C", "LW", "RW", "D", "G"].map((p) => `<button data-pos="${p}" class="${p === faState.pos ? "on" : ""}">${p === "ALL" ? "All" : p}</button>`).join("")}</div>
        <label class="chk"><input type="checkbox" id="tonightChk" ${faState.tonight ? "checked" : ""}> plays tonight</label>
      </div>
    </div>
    <div class="card" id="faTable"></div>
    <div class="sub" style="text-align:right">Adds happen on Yahoo. This API is read-only.</div>
  </section>`;
  $(".search").oninput = (e) => { faState.q = e.target.value; drawFA(); };
  $("#tonightChk").onchange = (e) => { faState.tonight = e.target.checked; drawFA(); };
  $("#posSeg").onclick = (e) => { const p = e.target.dataset.pos; if (p) { faState.pos = p; renderFA(); } };
  drawFA();
}
function drawFA() {
  const q = faState.q.toLowerCase();
  const rows = faState.rows.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!faState.tonight || p.tonight));
  const cats = faState.pos === "G" ? G_CATS : SK_CATS;
  const star = { h: "", f: (p) => `<button class="star ${watch.has(p.id) ? "on" : ""}" data-star="${esc(p.id)}" aria-label="Watch">${watch.has(p.id) ? "★" : "☆"}</button>` };
  const owned = { h: "Owned", f: (p) => `<span class="num">${p.owned ?? "—"}%</span>` };
  const delta = { h: "7d", f: (p) => p.owned_delta == null ? "—" : `<span class="num delta ${p.owned_delta > 0 ? "up" : p.owned_delta < 0 ? "down" : ""}">${p.owned_delta > 0 ? "+" : ""}${p.owned_delta}</span>` };
  $("#faTable").innerHTML = playerTable(rows, cats, { extra: [owned, delta, star] });
  const w = faState.rows.filter((p) => watch.has(p.id));
  $("#watchSec").innerHTML = w.length ? `<div class="row"><h2>Watching</h2><span class="sub end">${w.length} starred</span></div>
    <div class="watch">${w.map((p) => `<div class="wcard">
      <div class="row" style="gap:8px"><span class="n">${esc(p.name)}</span><span class="sub end">${posTag(p.pos)} ${esc(p.team)}</span></div>
      <div class="sub">${tonight(p)}</div>
      <div class="num">${SK_CATS.filter((c) => c in (p.stats || {})).slice(0, 3).map((c) => `${c} ${fmt(c, p.stats[c])}`).join(" · ") || (G_CATS.filter((c) => c in (p.stats || {})).map((c) => `${c} ${fmt(c, p.stats[c])}`).join(" · "))}</div>
      <div class="row" style="gap:8px"><span class="sub">${p.owned ?? "—"}% owned</span><button class="btn end" data-star="${esc(p.id)}" style="padding:3px 9px;font-size:12px">Unwatch</button></div>
    </div>`).join("")}</div>` : "";
  view.querySelectorAll("[data-star]").forEach((b) => b.onclick = () => { const id = b.dataset.star; watch.has(id) ? watch.delete(id) : watch.add(id); saveWatch(); drawFA(); });
}

/* ---------- router ---------- */
const routes = { team: renderTeam, matchup: () => renderMatchup(), fa: renderFA };
async function route() {
  const r = (location.hash.replace("#/", "") || "team").split("?")[0];
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.route === r));
  view.innerHTML = `<div class="empty">Loading…</div>`;
  try { await (routes[r] || renderTeam)(); }
  catch (e) { view.innerHTML = `<div class="empty">Could not load: ${esc(e.message)}</div>`; }
}
async function boot() {
  league = await api("/league");
  $("#meta").innerHTML = `<span>${esc(league.name)}</span><span>Week ${league.week}</span><span class="pill ${league.provider}">${league.provider === "mock" ? "mock data" : "live"}</span>`;
  addEventListener("hashchange", route);
  route();
}
boot();
