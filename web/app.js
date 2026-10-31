const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
const api = (p) => fetch(`/api${p}`).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (c, v) => v == null ? "—" : c === "SV%" ? Number(v).toFixed(3).replace(/^0/, "") : c === "GAA" ? Number(v).toFixed(2) : v;
const LOWER = new Set(["GAA"]);
const SK_CATS = ["G", "A", "P", "+/-", "PPP", "SOG", "HIT"];
const G_CATS = ["W", "GAA", "SV%", "SO"];
const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; };

let league = null;
const watch = new Set(JSON.parse(localStorage.getItem("fantasea.watch") || "[]"));
const saveWatch = () => localStorage.setItem("fantasea.watch", JSON.stringify([...watch]));
const prefs = JSON.parse(localStorage.getItem("fantasea.prefs") || "{}");
const savePrefs = () => localStorage.setItem("fantasea.prefs", JSON.stringify(prefs));

/* ---------- atoms ---------- */
const hue = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const avatar = (p, cls = "") => `<span class="av ${cls} ${p.tonight ? "on" : ""}" style="--hue:${hue(p.team || p.name)}">${p.headshot ? `<img src="${esc(p.headshot)}" alt="">` : esc(initials(p.name))}</span>`;
const posTag = (p) => `<span class="pos ${p === "G" ? "g" : /^(BN|IR)/.test(p) ? "bn" : ""}">${esc(p)}</span>`;
const beacon = (p) => p.tonight ? `<span class="beacon">${esc(p.tonight)}</span>` : `<span class="off">—</span>`;
const who = (p) => `<div class="who">${avatar(p)}<div><div class="nm">${esc(p.name)}</div><div class="tm">${esc(p.team)}${p.status && p.status !== "OK" ? ` · <span class="status">${esc(p.status)}</span>` : ""}</div></div></div>`;
function spark(t) {
  if (!t?.length) return "";
  const max = Math.max(...t, 1), w = 64, h = 18, step = w / (t.length - 1);
  const pts = t.map((v, i) => [i * step, h - (v / max) * h]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="-2 -2 ${w + 4} ${h + 4}"><path d="${d}"/><circle cx="${last[0]}" cy="${last[1]}" r="2"/></svg>`;
}
const heat = (c, v, max) => v == null || !max ? 0 : Math.min(1, Math.abs(v) / max);

function playerTable(rows, cats, { extra = [], dim = false, lead = [] } = {}) {
  if (!rows.length) return `<div class="empty">Nothing here</div>`;
  const maxes = Object.fromEntries(cats.map((c) => [c, Math.max(...rows.map((r) => Math.abs(+r.stats?.[c] || 0)))]));
  const head = ["", "Player", "Tonight", "GP", ...cats, "Trend", ...extra.map((e) => e.h)].map((h, i) =>
    `<th class="${i >= 3 && i < 4 + cats.length ? "r" : ""}">${esc(h)}</th>`).join("");
  const body = rows.map((p, i) => `<tr style="--i:${i}" class="${dim ? "dim" : ""}">
    <td>${posTag(p.pos)}</td>
    <td>${who(p)}</td>
    <td>${beacon(p)}</td>
    <td class="r fog">${p.gp_week ?? "—"}</td>
    ${cats.map((c) => `<td class="r heat" style="--h:${heat(c, p.stats?.[c], maxes[c]).toFixed(2)}">${fmt(c, p.stats?.[c])}</td>`).join("")}
    <td>${spark(p.trend)}</td>
    ${extra.map((e) => `<td>${e.f(p)}</td>`).join("")}</tr>`).join("");
  return `<div class="scroll"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function countUp(el) {
  const to = +el.dataset.count; if (isNaN(to)) return;
  const t0 = performance.now(), dur = 900;
  const tick = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.firstChild.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* ---------- team ---------- */
const SLOTS = { G: [[8, 38], [8, 62]], D: [[26, 26], [26, 74], [38, 18], [38, 82]], LW: [[58, 22], [74, 30]], C: [[58, 50], [76, 52]], RW: [[58, 78], [74, 72]] };
function rink(t) {
  const used = {}; const chips = [];
  [...t.skaters, ...t.goalies].forEach((p, i) => {
    const key = p.pos in SLOTS ? p.pos : "C";
    const n = used[key] = (used[key] || 0);
    const slot = SLOTS[key][n] || [50 + (n * 6), 50]; used[key]++;
    const pts = p.pos === "G" ? (p.stats?.W ?? 0) + " W" : (p.stats?.P ?? 0) + " P";
    chips.push(`<div class="chip ${p.tonight ? "" : "idle"}" style="left:${slot[0]}%;top:${slot[1]}%;--i:${i}" title="${esc(p.name)} · ${esc(p.tonight || "no game tonight")}">
      ${posTag(p.pos)}${avatar(p)}<span class="nm">${esc(p.name.split(" ").slice(-1)[0])}</span><span class="st">${pts}</span></div>`);
  });
  return `<div class="rinkwrap"><div class="rink">
    <svg viewBox="0 0 200 100" preserveAspectRatio="none">
      <line class="ln red" x1="100" y1="0" x2="100" y2="100"/>
      <line class="ln blue" x1="75" y1="0" x2="75" y2="100"/><line class="ln blue" x1="125" y1="0" x2="125" y2="100"/>
      <line class="ln red" x1="11" y1="20" x2="11" y2="80" style="stroke-width:.3"/><line class="ln red" x1="189" y1="20" x2="189" y2="80" style="stroke-width:.3"/>
      <circle class="ln" cx="100" cy="50" r="15"/><circle class="ln" cx="100" cy="50" r="1" fill="rgba(93,228,255,.5)"/>
      <circle class="ln" cx="40" cy="25" r="12"/><circle class="ln" cx="40" cy="75" r="12"/><circle class="ln" cx="160" cy="25" r="12"/><circle class="ln" cx="160" cy="75" r="12"/>
      <path class="crease" d="M11 42 a8 8 0 0 1 0 16 Z"/><path class="crease" d="M189 42 a8 8 0 0 0 0 16 Z"/>
    </svg>${chips.join("")}</div></div>`;
}

async function renderTeam() {
  const t = await api("/team");
  const idle = t.skaters.filter((p) => !p.tonight).length;
  const benchPlaying = t.bench.filter((p) => p.tonight).length;
  const mode = prefs.teamView || "rink";
  view.innerHTML = `
  <div class="row up" style="align-items:flex-end">
    <div class="stack">
      <h2>My team</h2>
      <h1>${esc(t.name)}</h1>
      <div class="sub">${esc(t.record)}${t.rank ? ` · ${t.rank}${ord(t.rank)} of ${league.teams}` : ""}${t.manager ? ` · ${esc(t.manager)}` : ""}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><b data-count="${t.games_left ?? ""}"><span>${t.games_left ?? "—"}</span></b><span>games left</span></div>
      <div class="kpi"><b data-count="${t.active_tonight ?? ""}"><span>${t.active_tonight ?? "—"}</span><small>/${t.slots}</small></b><span>skating tonight</span></div>
      <div class="kpi ${t.injured ? "warn" : ""}"><b data-count="${t.injured}"><span>${t.injured}</span></b><span>in the tank</span></div>
    </div>
  </div>
  <section class="section up" style="animation-delay:.08s">
    <div class="row"><h2>On the ice <span class="n">last 7 days</span></h2>
      <div class="toggle end"><button data-mode="rink" class="${mode === "rink" ? "on" : ""}">Rink</button><button data-mode="table" class="${mode === "table" ? "on" : ""}">Table</button></div></div>
    <div id="lineup"></div>
  </section>
  <section class="section up" style="animation-delay:.16s">
    <div class="row"><h2>Bench &amp; IR</h2>
      ${benchPlaying && idle ? `<span class="tag warn end">${benchPlaying} on the bench play tonight · ${idle} active ${idle > 1 ? "slots" : "slot"} idle</span>` : ""}</div>
    <div class="card">${playerTable([...t.bench, ...t.ir], SK_CATS, { dim: true })}</div>
  </section>`;
  const drawLineup = () => {
    const m = prefs.teamView || "rink";
    $("#lineup").innerHTML = m === "rink" ? rink(t) : `<div class="stack" style="gap:14px"><div class="card">${playerTable(t.skaters, SK_CATS)}</div>
      <div class="card">${playerTable(t.goalies, G_CATS, { extra: [{ h: "Start", f: (p) => p.start ? `<span class="${p.start === "Confirmed" ? "" : "muted"}">${esc(p.start)}</span>` : `<span class="off">—</span>` }] })}</div></div>`;
    view.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
  };
  view.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => { prefs.teamView = b.dataset.mode; savePrefs(); drawLineup(); });
  drawLineup();
  view.querySelectorAll("[data-count]").forEach(countUp);
}

/* ---------- matchup ---------- */
const fmtMargin = (c, d) => (d > 0 ? "+" : "") + (c === "SV%" ? d.toFixed(3) : c === "GAA" ? d.toFixed(2) : d);
const dateRange = (a, b) => { const o = { month: "short", day: "numeric" }; return `${new Date(a + "T12:00").toLocaleDateString(undefined, o)} – ${new Date(b + "T12:00").toLocaleDateString(undefined, o)}`; };

async function renderMatchup(week) {
  const m = await api(`/matchup${week ? `?week=${week}` : ""}`);
  const W = m.cats.filter((c) => c.result === "W").length, L = m.cats.filter((c) => c.result === "L").length, n = m.cats.length || 1;
  const rows = m.cats.map((c, i) => {
    const a = +c.me, b = +c.opp, tot = a + b || 1;
    let share = a / tot; if (LOWER.has(c.cat)) share = 1 - share;
    const edge = Math.abs(share - .5) * 2 * 50; // 0..50% of half-width
    const bar = c.result === "T" ? `<i class="tie" style="left:49%;width:2%"></i>` : c.result === "W" ? `<i class="me" style="width:${Math.max(4, edge).toFixed(1)}%;--i:${i}"></i>` : `<i class="op" style="width:${Math.max(4, edge).toFixed(1)}%;--i:${i}"></i>`;
    return `<tr style="--i:${i}">
      <td><b class="mono">${esc(c.cat)}</b></td>
      <td class="r" style="color:${c.result === "W" ? "var(--glow)" : "var(--ice)"}">${fmt(c.cat, a)}</td>
      <td style="width:38%"><div class="tug">${bar}</div></td>
      <td class="r" style="color:${c.result === "L" ? "var(--coral)" : "var(--mist)"}">${fmt(c.cat, b)}</td>
      <td class="r ${c.result === "L" ? "flag" : "muted"}">${c.result === "T" ? "—" : fmtMargin(c.cat, a - b)}</td>
      <td><span class="res ${c.result}">${c.result}</span></td></tr>`;
  }).join("");
  const maxG = Math.max(...m.schedule.flatMap((d) => [d.me, d.opp]), 1);
  view.innerHTML = `
  <div class="row up">
    <h2>Tide report <span class="n">week ${m.week}${m.start ? ` · ${dateRange(m.start, m.end)}` : ""}</span></h2>
    <div class="row end" style="gap:6px"><button class="btn" data-week="${m.week - 1}" aria-label="Previous week">←</button><button class="btn" data-week="${m.week + 1}" aria-label="Next week">→</button></div>
  </div>
  <div class="tide up" style="--mx:${(W / n * 100).toFixed(0)}%;--ox:${(100 - L / n * 100).toFixed(0)}%;animation-delay:.06s">
    <div class="versus">
      <div class="side"><h2>You</h2><div class="name">${esc(m.me.name)}</div>
        <div class="sub">${esc(m.me.record)}${m.me.rank ? ` · ${m.me.rank}${ord(m.me.rank)}` : ""}${m.me.games_left != null ? ` · ${m.me.games_left} games left` : ""}</div>
        <div class="big" data-count="${W}"><span>${W}</span></div><div class="sub">categories</div></div>
      <div class="center"><div class="score">${m.score.w}<i>·</i>${m.score.l}<i>·</i>${m.score.t}</div><div class="sub">W · L · T</div></div>
      <div class="side right"><h2>Opponent</h2><div class="name">${esc(m.opp.name)}</div>
        <div class="sub">${esc(m.opp.record)}${m.opp.rank ? ` · ${m.opp.rank}${ord(m.opp.rank)}` : ""}${m.opp.games_left != null ? ` · ${m.opp.games_left} games left` : ""}</div>
        <div class="big" data-count="${L}"><span>${L}</span></div><div class="sub">categories</div></div>
    </div>
    <div class="meter"><i class="me" style="width:0"></i><i class="op" style="width:0"></i></div>
  </div>
  <section class="section up" style="animation-delay:.12s">
    <div class="row"><h2>Categories</h2><span class="sub end">bar shows who's pulling ahead, and by how much</span></div>
    <div class="card"><div class="scroll"><table class="tbl">
      <thead><tr><th>Cat</th><th class="r">You</th><th></th><th class="r">Opp</th><th class="r">Margin</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="empty">No scoreboard data yet</td></tr>`}</tbody></table></div></div>
  </section>
  ${m.schedule.length ? `<section class="section up" style="animation-delay:.18s">
    <div class="row"><h2>Games this week</h2><span class="sub end"><span style="color:var(--glow)">●</span> you &nbsp;<span style="color:var(--coral)">●</span> opp</span></div>
    <div class="card"><div class="sched">${m.schedule.map((d, i) => `<div class="day ${d.opp - d.me >= 2 ? "warn" : ""}"><span>${esc(d.day)}</span>
      <div class="cols"><i class="me" style="height:${(d.me / maxG * 100).toFixed(0)}%;animation-delay:${i * 50}ms"></i><i class="op" style="height:${(d.opp / maxG * 100).toFixed(0)}%;animation-delay:${i * 50 + 60}ms"></i></div>
      <b>${d.me}<em>·</em>${d.opp}</b></div>`).join("")}</div></div>
  </section>` : ""}`;
  requestAnimationFrame(() => { $(".meter .me").style.width = `${(W / n * 50).toFixed(1)}%`; $(".meter .op").style.width = `${(L / n * 50).toFixed(1)}%`; });
  view.querySelectorAll("[data-week]").forEach((b) => b.onclick = () => renderMatchup(+b.dataset.week));
  view.querySelectorAll("[data-count]").forEach(countUp);
}

/* ---------- free agents ---------- */
const fa = { pos: "ALL", q: "", tonight: false, rows: [] };
async function renderFA() {
  fa.rows = await api(`/free-agents?pos=${fa.pos}`);
  view.innerHTML = `
  <section class="section up" id="watchSec"></section>
  <section class="section up" style="animation-delay:.06s">
    <div class="row">
      <h2>Trawling <span class="n">available players</span></h2>
      <div class="filters end">
        <input class="search" placeholder="Search players" value="${esc(fa.q)}" aria-label="Search players">
        <div class="seg" id="posSeg">${["ALL", "C", "LW", "RW", "D", "G"].map((p) => `<button data-pos="${p}" class="${p === fa.pos ? "on" : ""}">${p === "ALL" ? "All" : p}</button>`).join("")}</div>
        <label class="chk"><input type="checkbox" id="tonightChk" ${fa.tonight ? "checked" : ""}> plays tonight</label>
      </div>
    </div>
    <div class="card" id="faTable"></div>
    <div class="sub" style="text-align:right">Adds happen on Yahoo. This API is read-only.</div>
  </section>`;
  $(".search").oninput = (e) => { fa.q = e.target.value; drawFA(); };
  $("#tonightChk").onchange = (e) => { fa.tonight = e.target.checked; drawFA(); };
  $("#posSeg").onclick = (e) => { const p = e.target.dataset.pos; if (p) { fa.pos = p; renderFA(); } };
  drawFA();
}
function drawFA() {
  const q = fa.q.toLowerCase();
  const rows = fa.rows.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!fa.tonight || p.tonight));
  const cats = fa.pos === "G" ? G_CATS : SK_CATS;
  const owned = { h: "Owned", f: (p) => `<span class="mono" style="font-size:13px">${p.owned ?? "—"}%</span>` };
  const delta = { h: "7d", f: (p) => p.owned_delta == null ? "—" : `<span class="mono delta ${p.owned_delta > 0 ? "up" : p.owned_delta < 0 ? "down" : ""}" style="font-size:13px">${p.owned_delta > 0 ? "+" : ""}${p.owned_delta}</span>` };
  const star = { h: "", f: (p) => `<button class="star ${watch.has(p.id) ? "on" : ""}" data-star="${esc(p.id)}" aria-label="Watch ${esc(p.name)}">${watch.has(p.id) ? "★" : "☆"}</button>` };
  $("#faTable").innerHTML = playerTable(rows, cats, { extra: [owned, delta, star] });
  const w = fa.rows.filter((p) => watch.has(p.id));
  $("#watchSec").innerHTML = w.length ? `<div class="row"><h2>In the net <span class="n">${w.length} watched</span></h2></div>
    <div class="watch">${w.map((p, i) => `<div class="wcard" style="--i:${i}">
      <div class="row" style="gap:10px">${avatar(p)}<div><div class="nm" style="font-weight:600">${esc(p.name)}</div><div class="sub">${posTag(p.pos)} ${esc(p.team)}</div></div></div>
      <div class="row" style="gap:10px">${beacon(p)}<span class="end">${spark(p.trend)}</span></div>
      <div class="row" style="gap:8px"><span class="sub">${p.owned ?? "—"}% owned${p.owned_delta ? ` <span class="delta ${p.owned_delta > 0 ? "up" : "down"}">${p.owned_delta > 0 ? "+" : ""}${p.owned_delta}</span>` : ""}</span><button class="btn end" data-star="${esc(p.id)}">Release</button></div>
    </div>`).join("")}</div>` : "";
  view.querySelectorAll("[data-star]").forEach((b) => b.onclick = () => { const id = b.dataset.star; watch.has(id) ? watch.delete(id) : watch.add(id); saveWatch(); drawFA(); });
}

/* ---------- router ---------- */
const routes = { team: renderTeam, matchup: () => renderMatchup(), fa: renderFA };
function moveInd() {
  const a = $(".tabs a.active"); const ind = $("#ind"); if (!a) return;
  ind.style.left = a.offsetLeft + "px"; ind.style.width = a.offsetWidth + "px";
}
async function route() {
  const r = (location.hash.replace("#/", "") || "team").split("?")[0];
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.route === r));
  moveInd();
  view.innerHTML = `<div class="skel"></div>`;
  try { await (routes[r] || renderTeam)(); }
  catch (e) { view.innerHTML = `<div class="empty">Could not load: ${esc(e.message)}</div>`; }
}
async function boot() {
  league = await api("/league");
  $("#meta").innerHTML = `<span>${esc(league.name)}</span><span>Week ${league.week}</span><span class="pill ${league.provider}">${league.provider === "mock" ? "mock data" : "live"}</span>`;
  addEventListener("hashchange", route);
  addEventListener("resize", moveInd);
  document.fonts?.ready.then(moveInd);
  route();
}
boot();
