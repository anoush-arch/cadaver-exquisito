/** @OnlyCurrentDoc */
/**
 * Cadáver Exquisito — backend en Google Apps Script.
 *
 * Guarda cada partida como una fila de la hoja "partidas" (JSON en la columna B)
 * y avisa por mail a quien le toca, desde la cuenta de Google que lo instala.
 *
 * Instalación: ver README.md. Resumen: crear una Google Sheet, Extensiones →
 * Apps Script, pegar este archivo, Implementar → Nueva implementación →
 * Aplicación web, "Ejecutar como: yo", "Quién tiene acceso: cualquier persona".
 */

const SHEET_NAME = 'partidas';
const MAX_PLAYERS = 8;
const MAX_TEXT = 2000;
const REMIND_EVERY_MS = 60 * 60 * 1000; // un recordatorio por hora, como mucho
const MAX_GAMES_PER_DAY = 20;            // tope de partidas nuevas por día

// ---------- entrada HTTP ----------

function doGet(e) {
  return respond_(handle_((e && e.parameter) || {}));
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  return respond_(handle_(body));
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function handle_(req) {
  try {
    switch (req.action) {
      case 'create': return create_(req);
      case 'view':   return view_(req.g, req.p);
      case 'submit': return submit_(req);
      case 'remind': return remind_(req);
      default:       return { ok: true, app: 'cadaver-exquisito' };
    }
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
}

// ---------- acciones ----------

function create_(req) {
  checkKey_(req.key);
  const title = clean_(req.title, 60) || 'Partida sin título';
  const opener = clean_(req.opener, 300);
  const rounds = Math.max(1, Math.min(6, parseInt(req.rounds, 10) || 3));
  const baseUrl = String(req.baseUrl || '');
  if (!/^https?:\/\//.test(baseUrl)) throw new Error('Falta la dirección de la página.');

  const raw = Array.isArray(req.players) ? req.players : [];
  const players = raw
    .map(p => ({ name: clean_(p && p.name, 30), email: cleanEmail_(p && p.email) }))
    .filter(p => p.name);
  if (players.length < 2) throw new Error('Hacen falta al menos dos jugadores con nombre.');
  if (players.length > MAX_PLAYERS) throw new Error('Como mucho ' + MAX_PLAYERS + ' jugadores.');
  players.forEach(p => { p.token = token_(); });

  const game = {
    id: token_().slice(0, 10),
    title, opener, baseUrl,
    target: rounds * players.length,
    players,
    turns: [],
    createdAt: Date.now(),
    lastRemindAt: 0
  };

  withLock_(() => { countCreation_(); save_(game); });

  // Invitaciones: cada uno recibe su link personal.
  const mailed = [];
  game.players.forEach((p, i) => {
    if (!p.email) return;
    const first = i === 0;
    const ok = mail_(p.email,
      first ? 'Te toca empezar «' + game.title + '»'
            : game.players[0].name + ' te invitó a un cadáver exquisito',
      letter_(p.name,
        first
          ? 'Arrancaste una partida nueva: «' + esc_(game.title) + '». El primer turno es tuyo.'
          : esc_(game.players[0].name) + ' armó una partida de cadáver exquisito: «' + esc_(game.title) +
            '». Cada uno escribe un pedacito viendo solo la última línea del anterior. Te vamos a avisar por acá cuando te toque.',
        link_(game, i), first ? 'Escribir mi parte' : 'Ver la partida'));
    if (ok) mailed.push(i);
  });

  const v = viewOf_(game, 0);
  v.mailed = mailed;
  return v;
}

function view_(g, p) {
  const game = load_(g);
  return viewOf_(game, playerIndex_(game, p));
}

function submit_(req) {
  const text = String(req.text || '').replace(/\r/g, '').trim().slice(0, MAX_TEXT);
  if (!text) throw new Error('Tu parte está vacía.');

  let game, me, mailedTo = null;
  withLock_(() => {
    game = load_(req.g);
    me = playerIndex_(game, req.p);
    if (isDone_(game)) throw new Error('La partida ya terminó.');
    if (turnOf_(game) !== me) throw new Error('Ahora no es tu turno. Le toca a ' + game.players[turnOf_(game)].name + '.');
    game.turns.push({ p: me, text: text, tail: tailOf_(text), at: Date.now() });
    game.lastRemindAt = 0;
    save_(game);
  });

  if (isDone_(game)) {
    game.players.forEach((pl, i) => {
      if (!pl.email) return;
      mail_(pl.email, 'Se desplegó el papel: «' + game.title + '»',
        letter_(pl.name, 'Ya escribieron todos. El cadáver exquisito «' + esc_(game.title) + '» está completo y se puede leer entero.',
          link_(game, i), 'Leerlo entero'));
    });
  } else {
    const next = turnOf_(game);
    const np = game.players[next];
    if (np.email && mail_(np.email, 'Te toca en «' + game.title + '»',
        letter_(np.name, esc_(game.players[me].name) + ' ya escribió su parte de «' + esc_(game.title) + '». Ahora te toca a vos.',
          link_(game, next), 'Escribir mi parte'))) {
      mailedTo = next;
    }
  }

  const v = viewOf_(game, me);
  v.mailedTo = mailedTo;
  return v;
}

function remind_(req) {
  let game, sent = false, who;
  withLock_(() => {
    game = load_(req.g);
    const me = playerIndex_(game, req.p);
    if (isDone_(game)) throw new Error('La partida ya terminó.');
    who = turnOf_(game);
    if (who === me) throw new Error('Te toca a vos.');
    const pl = game.players[who];
    if (!pl.email) throw new Error(pl.name + ' no dejó mail. Avisale por WhatsApp.');
    if (Date.now() - (game.lastRemindAt || 0) < REMIND_EVERY_MS) throw new Error('Ya se le recordó hace poco. Probá en un rato.');
    sent = mail_(pl.email, 'Recordatorio: te toca en «' + game.title + '»',
      letter_(pl.name, esc_(game.players[me].name) + ' te recuerda que te toca escribir en «' + esc_(game.title) + '».',
        link_(game, who), 'Escribir mi parte'));
    if (sent) { game.lastRemindAt = Date.now(); save_(game); }
  });
  if (!sent) throw new Error('No se pudo mandar el mail.');
  return { ok: true, to: game.players[who].name };
}

// ---------- protección ----------

/** Solo quien sabe la clave puede crear partidas (y por lo tanto mandar invitaciones). */
function checkKey_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('CLAVE');
  if (!expected) throw new Error('Falta configurar la clave en Apps Script (ver README).');
  if (String(key || '') !== expected) throw new Error('Clave incorrecta.');
}

function countCreation_() {
  const props = PropertiesService.getScriptProperties();
  const k = 'creadas-' + new Date().toISOString().slice(0, 10);
  const n = parseInt(props.getProperty(k) || '0', 10);
  if (n >= MAX_GAMES_PER_DAY) throw new Error('Se alcanzó el máximo de partidas nuevas por hoy. Probá mañana.');
  props.setProperty(k, String(n + 1));
}

// ---------- lógica del juego ----------

function isDone_(game) { return game.turns.length >= game.target; }
function turnOf_(game) { return isDone_(game) ? null : game.turns.length % game.players.length; }

function playerIndex_(game, token) {
  const i = game.players.findIndex(p => p.token === token);
  if (i < 0) throw new Error('Este link no corresponde a ningún jugador de la partida.');
  return i;
}

/** Lo que ve el jugador `me`. Nunca incluye texto oculto mientras la partida sigue. */
function viewOf_(game, me) {
  const n = game.turns.length;
  const done = isDone_(game);
  const turnOf = turnOf_(game);
  const last = game.turns[n - 1];

  const folds = [];
  if (n >= 1 && game.opener) folds.push(-1);
  game.turns.slice(0, Math.max(0, n - 1)).forEach(t => folds.push(t.p));

  const v = {
    id: game.id,
    title: game.title,
    target: game.target,
    n: n,
    done: done,
    me: me,
    turnOf: turnOf,
    players: game.players.map(p => ({ name: p.name, hasEmail: !!p.email })),
    folds: done ? [] : folds,
    visible: done ? null : (last ? { who: last.p, text: last.tail } : (game.opener ? { who: -1, text: game.opener } : null)),
    full: done ? { opener: game.opener, turns: game.turns.map(t => ({ p: t.p, text: t.text })) } : null,
    nextLink: done ? null : link_(game, turnOf)
  };
  if (me === 0) {
    v.links = game.players.map((p, i) => link_(game, i));
    v.emails = game.players.map(p => p.email || '');
  }
  return v;
}

/** Última línea visible: si es muy larga, sus últimas palabras. */
function tailOf_(text) {
  const lines = String(text).trim().split(/\n+/).map(l => l.trim()).filter(Boolean);
  let last = lines[lines.length - 1] || '';
  const words = last.split(/\s+/);
  if (words.length > 12) last = '… ' + words.slice(-10).join(' ');
  return last;
}

function link_(game, i) {
  return game.baseUrl.replace(/[?#].*$/, '') + '?g=' + game.id + '&p=' + game.players[i].token;
}

// ---------- almacenamiento ----------

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['id', 'partida (no editar a mano)', 'actualizada']);
  }
  return sh;
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function load_(id) {
  if (!id) throw new Error('Falta la partida en el link.');
  const sh = sheet_();
  const row = findRow_(sh, id);
  if (row < 0) throw new Error('No encontré esa partida.');
  return JSON.parse(sh.getRange(row, 2).getValue());
}

function save_(game) {
  const sh = sheet_();
  const row = findRow_(sh, game.id);
  const values = [[game.id, JSON.stringify(game), new Date()]];
  if (row < 0) sh.appendRow(values[0]);
  else sh.getRange(row, 1, 1, 3).setValues(values);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Hay mucha gente escribiendo a la vez. Probá de nuevo.');
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- mails ----------

function mail_(to, subject, html) {
  try {
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: 'Cadáver Exquisito' });
    return true;
  } catch (err) {
    console.error('mail', to, err);
    return false;
  }
}

function letter_(name, body, url, cta) {
  return '<div style="max-width:520px;margin:0 auto;padding:28px 28px 24px;background:#fff;border:1px solid #e6e6e6;' +
    'font-family:Georgia,serif;color:#161616;font-size:17px;line-height:1.6;' +
    'background-image:linear-gradient(#fff 31px,#dfe7f2 31px);background-size:100% 32px">' +
    '<p style="margin:0 0 14px">Querido/a ' + esc_(name) + ':</p>' +
    '<p style="margin:0 0 22px">' + body + '</p>' +
    '<p style="margin:0 0 22px"><a href="' + url + '" style="display:inline-block;background:#161616;color:#fff;' +
    'text-decoration:none;padding:12px 20px;border-radius:8px;font-family:Arial,sans-serif;font-weight:bold">' + cta + '</a></p>' +
    '<p style="margin:0;color:#666;font-size:14px">Este es tu link personal, no lo reenvíes:<br>' +
    '<a href="' + url + '" style="color:#1f3a93;word-break:break-all">' + url + '</a></p></div>';
}

// ---------- utilidades ----------

function clean_(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max); }
function cleanEmail_(s) {
  const e = String(s || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e.slice(0, 120) : '';
}
function token_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); }
function esc_(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Para probar los permisos desde el editor: Ejecutar → autorizarTodo. */
function autorizarTodo() {
  sheet_();
  console.log('Mails que quedan hoy: ' + MailApp.getRemainingDailyQuota());
}
