(function () {
  "use strict";

  const API = window.CADAVER_API;
  const INKS = ["#1f3a93", "#b3261e", "#1b6b3a", "#6a2c91", "#8a5a12", "#0f6e7a", "#ad1457", "#37474f"];
  const OPENER_INK = "#7a7d82";
  const MAX_PLAYERS = 8;

  const OPENERS = [
    "El caballo entró a la sucursal del banco y pidió hablar con el gerente.",
    "El día que la heladera empezó a hablar, el primero en enterarse fue el portero.",
    "En la última parada del 60 había una puerta que nadie se animaba a abrir.",
    "La abuela guardaba en el freezer un frasco con una tormenta adentro.",
    "Esa mañana el río amaneció dulce como dulce de leche y nadie quiso explicar por qué.",
    "El médico de guardia anotó en la planilla: «paciente afirma ser una tortuga de 300 años».",
    "Cuando abrí el diario, todas las noticias hablaban de mí.",
    "El loro del vecino sabía tres idiomas y ningún secreto que se pudiera repetir.",
    "En el subte había un señor vendiendo minutos de silencio a diez pesos cada uno.",
    "Mi sombra se fue de vacaciones a Mar del Plata y no avisó.",
    "El ascensor se detuvo entre el piso 4 y el piso 5, en un piso que no existía.",
    "La cebolla del guiso se negó a ser cortada sin antes dar un discurso.",
    "Encontramos un mapa del tesoro dibujado en el reverso de una boleta de luz.",
    "El reloj de la cocina empezó a andar para atrás justo a la hora del mate.",
    "Un pingüino con sombrero se sentó en la mesa de al lado y pidió un cortado.",
    "La enfermera tenía una teoría sobre las nubes que nadie quería escuchar.",
    "Ese verano el mar decidió retroceder tres cuadras para ver qué había del otro lado.",
    "Mi primo heredó un piano que solo tocaba tangos cuando llovía.",
    "En la verdulería vendían limones que contaban chistes malos.",
    "La carta llegó con cuarenta años de atraso y un sello de un país inventado.",
    "El perro de la plaza fue elegido presidente del consorcio por unanimidad.",
    "A las tres de la mañana, la tele se prendió sola y dijo mi nombre.",
    "El astronauta volvió a la Tierra con una receta de empanadas lunares.",
    "Debajo del adoquín número mil de la calle Florida vivía una familia de topos elegantes.",
    "El cartero se negó a entregar el paquete porque, según él, estaba triste.",
    "Un domingo cualquiera, todos los gatos de Buenos Aires se reunieron en el Obelisco.",
    "La máquina de café del hospital había empezado a dar consejos sentimentales.",
    "El mago se olvidó cómo devolver al conejo y ahora el conejo vive con él.",
    "En el fondo del ropero había una escalera que bajaba hasta otro siglo.",
    "El último tren a Tigre salió sin pasajeros y volvió lleno de desconocidos."
  ];

  const $ = s => document.querySelector(s);
  const main = $("#main");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ink = i => (i === -1 ? OPENER_INK : INKS[i % INKS.length]);

  // ---------- almacenamiento local (comodidad, no es la fuente de verdad) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function rememberGame(v, p) {
    const list = store.get("cadaver:games", []).filter(x => x.g !== v.id);
    list.unshift({ g: v.id, p: p, title: v.title, at: Date.now() });
    store.set("cadaver:games", list.slice(0, 30));
  }

  // ---------- red ----------
  async function api(body) {
    let r;
    try {
      r = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    } catch (e) {
      throw new Error("No hay conexión. Revisá internet y probá de nuevo.");
    }
    let j;
    try { j = await r.json(); } catch (e) { throw new Error("El servidor respondió algo raro. Probá de nuevo en un rato."); }
    if (j.error) throw new Error(j.error);
    return j;
  }

  // ---------- utilidades de interfaz ----------
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 2800);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Copiado."); }
    catch (e) { window.prompt("Copiá este texto:", text); }
  }
  const wa = text => "https://wa.me/?text=" + encodeURIComponent(text);
  function tailOf(text) {
    const lines = String(text).trim().split(/\n+/).map(l => l.trim()).filter(Boolean);
    let last = lines[lines.length - 1] || "";
    const words = last.split(/\s+/);
    if (words.length > 12) last = "… " + words.slice(-10).join(" ");
    return last;
  }
  function pickOpener(not) {
    let o; do { o = OPENERS[Math.floor(Math.random() * OPENERS.length)]; } while (o === not);
    return o;
  }
  function statusOf(v) {
    if (v.done) return { k: "done", txt: "Lista para leer" };
    if (v.turnOf === v.me) return { k: "go", txt: "Te toca" };
    return { k: "wait", txt: "Le toca a " + v.players[v.turnOf].name };
  }
  const stamp = s => `<span class="stamp ${s.k}">${esc(s.txt)}</span>`;
  function go(url) { history.pushState(null, "", url); route(); }
  function fail(e) { toast(e.message || String(e)); }

  // ---------- pantallas ----------

  function renderSetup() {
    main.innerHTML = `<h2>Falta un paso</h2>
      <p class="note">La página todavía no está conectada a su planilla de Google. Abrí <b>config.js</b> y pegá la URL de Apps Script, como dice el README.</p>`;
  }

  function renderError(msg) {
    main.innerHTML = `<h2>Uy</h2><p class="note">${esc(msg)}</p><div><a class="btn ghost" href="./">Ir al inicio</a></div>`;
  }

  // --- inicio: mis partidas + nueva partida
  function renderHome() {
    const mine = store.get("cadaver:games", []);
    const prefill = store.get("cadaver:prefill", null);
    store.del("cadaver:prefill");
    const players = prefill && prefill.length >= 2 ? prefill : [{ name: "Anoush", email: "" }, { name: "Shikito", email: "" }];
    let opener = pickOpener();

    main.innerHTML = `
      ${mine.length ? `<section class="stack"><h2>Mis partidas</h2><div class="games" id="mine">
        ${mine.map(x => `<button class="game" data-g="${esc(x.g)}" data-p="${esc(x.p)}"><span class="t">${esc(x.title)}</span><span class="row" style="flex-wrap:nowrap"><span class="s" data-s>…</span></span></button>`).join("")}
      </div></section><hr class="sep">` : ""}
      <section class="stack">
        <h2>Nueva partida</h2>
        <div class="opener-box">
          <span class="label">Primera línea, por el azar</span>
          <div class="ruled paper-strip" style="--c:${OPENER_INK}" id="opener">${esc(opener)}</div>
          <div><button class="link" id="reroll" type="button">Otra primera línea</button></div>
        </div>
        <label class="stack" style="gap:2px"><span class="label">Título (opcional)</span>
          <input type="text" id="title" maxlength="60" placeholder="Por ejemplo: «El pingüino del cortado»"></label>
        <div class="stack">
          <span class="label">Jugadores, en orden de turno</span>
          <p class="note">Con mail, a cada uno le avisamos cuando le toca. Sin mail, le pasás su link por WhatsApp.</p>
          <div class="players" id="players"></div>
          <div><button class="link" id="add" type="button">+ Sumar jugador</button></div>
        </div>
        <div class="row"><label for="rounds" class="label">Vueltas</label>
          <select id="rounds"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select>
          <span class="note" id="turnsNote"></span></div>
        <div><button id="create">Empezar la partida</button></div>
      </section>`;

    const box = $("#players");
    function drawPlayers() {
      box.innerHTML = players.map((p, i) => `
        <div class="prow" style="--c:${ink(i)}">
          <span class="dot" aria-hidden="true"></span>
          <input type="text" id="pn${i}" maxlength="30" placeholder="${i === 0 ? "Tu nombre" : "Nombre"}" value="${esc(p.name)}" aria-label="Nombre del jugador ${i + 1}">
          <input type="email" id="pe${i}" maxlength="120" placeholder="Mail (opcional)" value="${esc(p.email)}" aria-label="Mail del jugador ${i + 1}">
          ${players.length > 2 ? `<button class="x" type="button" data-rm="${i}" aria-label="Sacar jugador">×</button>` : "<span></span>"}
        </div>`).join("");
      box.querySelectorAll("input").forEach(inp => inp.oninput = () => {
        const i = +inp.id.slice(2); players[i][inp.id[1] === "n" ? "name" : "email"] = inp.value;
      });
      box.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { players.splice(+b.dataset.rm, 1); drawPlayers(); turnsNote(); });
      $("#add").hidden = players.length >= MAX_PLAYERS;
    }
    function turnsNote() { $("#turnsNote").textContent = "= " + (+$("#rounds").value * players.length) + " turnos en total"; }
    drawPlayers(); turnsNote();
    $("#rounds").onchange = turnsNote;
    $("#add").onclick = () => { players.push({ name: "", email: "" }); drawPlayers(); turnsNote(); $("#pn" + (players.length - 1)).focus(); };
    $("#reroll").onclick = () => { opener = pickOpener(opener); $("#opener").textContent = opener; };

    $("#create").onclick = async () => {
      const list = players.map(p => ({ name: p.name.trim(), email: p.email.trim() })).filter(p => p.name);
      if (list.length < 2) return toast("Hacen falta al menos dos jugadores con nombre.");
      const bad = list.find(p => p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email));
      if (bad) return toast("Revisá el mail de " + bad.name + ".");
      const btn = $("#create"); btn.disabled = true; btn.textContent = "Armando el sobre…";
      try {
        const v = await api({
          action: "create", title: $("#title").value.trim(), opener: opener,
          rounds: +$("#rounds").value, players: list,
          baseUrl: location.origin + location.pathname
        });
        const myToken = new URL(v.links[0]).searchParams.get("p");
        rememberGame(v, myToken);
        renderCreated(v, myToken);
        history.pushState(null, "", location.pathname + "?created=1");
      } catch (e) { fail(e); btn.disabled = false; btn.textContent = "Empezar la partida"; }
    };

    // estado de mis partidas, en paralelo
    main.querySelectorAll("#mine .game").forEach(async b => {
      b.onclick = () => go("?g=" + encodeURIComponent(b.dataset.g) + "&p=" + encodeURIComponent(b.dataset.p));
      try {
        const v = await api({ action: "view", g: b.dataset.g, p: b.dataset.p });
        b.querySelector("[data-s]").outerHTML = `<span class="s">${v.n}/${v.target}</span>${stamp(statusOf(v))}`;
      } catch (e) { const s = b.querySelector("[data-s]"); if (s) s.textContent = "—"; }
    });
  }

  // --- recién creada: los links de cada uno
  function renderCreated(v, myToken) {
    const mailed = v.mailed || [];
    main.innerHTML = `
      <h2>Partida lista</h2>
      <p class="note">Cada jugador tiene su propio link: con ese link entra y sabe que es él. ${mailed.length ? "A los que tienen mail ya les mandamos el suyo." : ""}</p>
      <div class="links">
        ${v.players.map((p, i) => `
          <div class="link-row" style="--c:${ink(i)}">
            <div class="row spread"><h3>${esc(p.name)}${i === 0 ? " (vos)" : ""}</h3>
              ${mailed.includes(i) ? `<span class="note">Mail enviado</span>` : ""}</div>
            <code>${esc(v.links[i])}</code>
            ${i === 0 ? "" : `<div class="row">
              <a class="btn small" href="${esc(wa("¡" + p.name + "! Te invito a jugar al cadáver exquisito «" + v.title + "». Este es tu link personal: " + v.links[i]))}" target="_blank" rel="noopener">Mandar por WhatsApp</a>
              <button class="small ghost" data-copy="${i}">Copiar link</button></div>`}
          </div>`).join("")}
      </div>
      <div><button id="mine">Ir a la partida</button></div>`;
    main.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copy(v.links[+b.dataset.copy]));
    $("#mine").onclick = () => go("?g=" + v.id + "&p=" + myToken);
  }

  // --- la partida
  let pollTimer = null;
  async function renderGame(g, p, preloaded) {
    let v = preloaded;
    if (!v) {
      try { v = await api({ action: "view", g, p }); }
      catch (e) { return renderError(e.message); }
    }
    rememberGame(v, p);
    document.title = v.title + " · Cadáver Exquisito";
    const s = statusOf(v);
    const back = `<div><a href="./" class="btn ghost small">← Mis partidas</a></div>`;
    const head = `<div class="stack" style="gap:4px"><h2>${esc(v.title)}</h2>
      <div class="row spread"><span class="label">${v.done ? v.target + " turnos" : "Turno " + (v.n + 1) + " de " + v.target}</span>${stamp(s)}</div></div>`;

    if (v.done) {
      const parts = [];
      if (v.full.opener) parts.push({ who: -1, name: "El azar", text: v.full.opener });
      v.full.turns.forEach(t => parts.push({ who: t.p, name: v.players[t.p].name, text: t.text }));
      main.innerHTML = `${back}${head}
        <span class="label">El papel desplegado</span>
        <div class="reveal">${parts.map(x => `<div class="paper-strip" style="--c:${ink(x.who)}"><span class="who">${esc(x.name)}</span><p class="ruled">${esc(x.text)}</p></div>`).join("")}</div>
        <div class="row">
          <button id="copyAll" class="ghost">Copiar el texto</button>
          <a class="btn ghost" id="waAll" target="_blank" rel="noopener">Mandarlo por WhatsApp</a>
          <button id="again">Jugar otra con los mismos</button>
        </div>`;
      const all = v.title + "\n\n" + parts.map(x => x.text).join("\n\n");
      $("#copyAll").onclick = () => copy(all);
      $("#waAll").href = wa(all);
      $("#again").onclick = () => {
        store.set("cadaver:prefill", v.players.map((pl, i) => ({ name: pl.name, email: (v.emails && v.emails[i]) || "" })));
        go("./");
      };
      return;
    }

    const folds = v.folds.length ? `<div class="folds" aria-label="${v.folds.length} partes dobladas">${v.folds.map(w => `<div class="fold" style="--c:${ink(w)}"></div>`).join("")}</div>` : "";
    const vis = v.visible
      ? `<div class="stack" style="gap:0"><span class="label">${v.n === 0 ? "Primera línea, por el azar" : "Lo único que se ve (de " + esc(v.players[v.visible.who].name) + ")"}</span>
          <div class="ruled paper-strip" style="--c:${ink(v.visible.who)}">${esc(v.visible.text)}</div></div>`
      : `<p class="note">Papel en blanco. Arrancá con lo que quieras.</p>`;
    const nextName = v.players[v.turnOf].name;

    if (s.k === "go") {
      const nextAfter = v.players[(v.turnOf + 1) % v.players.length].name;
      main.innerHTML = `${back}${head}${folds}${vis}
        <label class="stack" style="gap:0" for="txt"><span class="label">Tu parte</span></label>
        <div class="paper-strip" style="--c:${ink(v.me)}"><textarea id="txt" class="ruled" placeholder="Seguí desde esa línea. Dos o tres renglones alcanzan." style="color:${ink(v.me)}"></textarea></div>
        <p class="note" id="pv"></p>
        <div><button id="send" disabled>${v.n + 1 === v.target ? "Escribir el final y desplegar" : "Doblar y pasar"}</button></div>`;
      const ta = $("#txt"), pv = $("#pv"), send = $("#send");
      ta.value = store.get("draft:" + g, "");
      const upd = () => {
        const t = ta.value.trim(); send.disabled = !t;
        pv.innerHTML = v.n + 1 === v.target ? "Es el último turno: al mandarlo se despliega el papel para todos."
          : t ? `${esc(nextAfter)} solo va a ver: <i>${esc(tailOf(t))}</i>` : `${esc(nextAfter)} solo va a ver tu última línea.`;
        store.set("draft:" + g, ta.value);
      };
      ta.oninput = upd; upd();
      send.onclick = async () => {
        send.disabled = true; send.textContent = "Doblando…";
        try {
          const nv = await api({ action: "submit", g, p, text: ta.value });
          store.del("draft:" + g);
          if (nv.done) { toast("¡Listo! Se desplegó el papel."); renderGame(g, p, nv); }
          else renderPassed(g, p, nv);
        } catch (e) { fail(e); send.disabled = false; send.textContent = "Doblar y pasar"; }
      };
    } else {
      main.innerHTML = `${back}${head}${folds}
        <p class="note">Ya está en manos de <b>${esc(nextName)}</b>. Cuando escriba, te toca a quien siga.</p>
        ${nudges(v)}`;
      wireNudges(v, g, p);
    }

    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const ta = $("#txt"); if (ta && ta.value.trim()) return;
      try {
        const nv = await api({ action: "view", g, p });
        if (nv.n !== v.n) renderGame(g, p, nv);
      } catch (e) {}
    }, 30000);
  }

  function nudges(v) {
    const pl = v.players[v.turnOf];
    return `<div class="row">
      <a class="btn small" target="_blank" rel="noopener" href="${esc(wa("¡" + pl.name + ", te toca en el cadáver exquisito «" + v.title + "»! " + v.nextLink))}">Avisarle a ${esc(pl.name)} por WhatsApp</a>
      ${pl.hasEmail ? `<button class="small ghost" id="remind">Recordarle por mail</button>` : ""}
    </div>`;
  }
  function wireNudges(v, g, p) {
    const r = $("#remind"); if (!r) return;
    r.onclick = async () => {
      r.disabled = true;
      try { const res = await api({ action: "remind", g, p }); toast("Le mandamos un recordatorio a " + res.to + "."); }
      catch (e) { fail(e); r.disabled = false; }
    };
  }

  // --- después de escribir
  function renderPassed(g, p, v) {
    const pl = v.players[v.turnOf];
    main.innerHTML = `<h2>Doblado y pasado</h2>
      <div class="folds">${v.folds.concat([v.me]).map(w => `<div class="fold" style="--c:${ink(w)}"></div>`).join("")}</div>
      <p class="note">Ahora le toca a <b>${esc(pl.name)}</b>. ${v.mailedTo === v.turnOf ? "Ya le mandamos un mail." : pl.hasEmail ? "No pudimos mandarle el mail: avisale por WhatsApp." : "No tiene mail cargado: avisale por WhatsApp."}</p>
      ${nudges(v).replace(/<button class="small ghost" id="remind">[^<]*<\/button>/, "")}
      <div><a href="./" class="btn ghost">Volver a mis partidas</a></div>`;
  }

  // ---------- ruteo ----------
  function route() {
    clearInterval(pollTimer);
    document.title = "Cadáver Exquisito";
    if (!API || /PEGAR_URL/.test(API)) return renderSetup();
    const q = new URLSearchParams(location.search);
    if (q.get("g") && q.get("p")) return renderGame(q.get("g"), q.get("p"));
    renderHome();
  }
  window.addEventListener("popstate", route);
  route();
})();
