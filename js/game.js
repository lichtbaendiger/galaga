/* ============================================================
   game.js – GALAGA Web Arcade (Homage an Namco 1981)
   Logische Auflösung 224x288 (wie das Original-Automat),
   integer-Skalierung = scharfe Pixel.
   ============================================================ */
(function () {
  "use strict";

  var W = 224, H = 288, CX = 112;

  /* ---------- Canvas & Skalierung ---------- */
  var canvas = document.getElementById("game");
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext("2d");

  function fit() {
    var mw = Math.max(200, window.innerWidth - 44);
    var mh = Math.max(200, window.innerHeight - 84);
    var s = Math.max(1, Math.min(Math.floor(mw / W), Math.floor(mh / H), 6));
    canvas.style.width = (W * s) + "px";
    canvas.style.height = (H * s) + "px";
  }
  window.addEventListener("resize", fit);

  /* ---------- Helfer ---------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function txt(s, x, y, color, o) { PX.text(ctx, s, x, y, color, o); }
  function drawSpr(name, pal, cx, cy, o) { PX.draw(ctx, PX.sprite(name, pal), cx, cy, o); }

  /* ---------- Catmull-Rom-Spline mit Bogenlänge ---------- */
  function Spline(pts) {
    var P = pts.slice();
    P.unshift(P[0]); P.push(P[P.length - 1]);
    var s = [], cum = [0], len = 0, i, k, t, t2, t3, x, y, px = 0, py = 0;
    for (i = 1; i < P.length - 2; i++) {
      var p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      for (k = (i === 1 ? 0 : 1); k <= 16; k++) {
        t = k / 16; t2 = t * t; t3 = t2 * t;
        x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        if (s.length) len += Math.hypot(x - px, y - py);
        s.push({ x: x, y: y }); cum.push(len);
        px = x; py = y;
      }
    }
    this.s = s; this.c = cum; this.len = len;
  }
  Spline.prototype.at = function (d) {
    d = clamp(d, 0, this.len);
    var lo = 0, hi = this.c.length - 1;
    while (lo + 1 < hi) { var m = (lo + hi) >> 1; if (this.c[m] <= d) lo = m; else hi = m; }
    var a = this.s[lo], b = this.s[Math.min(hi, this.s.length - 1)];
    var seg = this.c[hi] - this.c[lo] || 1, t = (d - this.c[lo]) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  function mirrorX(pts) { return pts.map(function (p) { return { x: W - p.x, y: p.y }; }); }

  /* ---------- Einflug- & Kampfpfade ---------- */
  var SPL = {
    loopL: [{ x: -16, y: 258 }, { x: 38, y: 258 }, { x: 84, y: 244 }, { x: 96, y: 212 }, { x: 72, y: 190 }, { x: 38, y: 196 }, { x: 34, y: 228 }, { x: 60, y: 252 }, { x: 112, y: 250 }, { x: 150, y: 226 }, { x: 158, y: 190 }],
    topR:  [{ x: 240, y: -18 }, { x: 196, y: -14 }, { x: 150, y: 6 }, { x: 116, y: 40 }, { x: 96, y: 78 }, { x: 110, y: 108 }, { x: 142, y: 106 }, { x: 154, y: 74 }, { x: 140, y: 44 }],
    chalA: [{ x: -16, y: 150 }, { x: 30, y: 112 }, { x: 84, y: 92 }, { x: 136, y: 96 }, { x: 180, y: 124 }, { x: 208, y: 168 }, { x: 212, y: 222 }, { x: 188, y: 268 }, { x: 150, y: 300 }],
    chalB: [{ x: -16, y: 230 }, { x: 44, y: 244 }, { x: 92, y: 216 }, { x: 96, y: 168 }, { x: 64, y: 140 }, { x: 40, y: 160 }, { x: 48, y: 200 }, { x: 90, y: 224 }, { x: 140, y: 212 }, { x: 180, y: 240 }, { x: 210, y: 300 }],
    chalC: [{ x: -16, y: 60 }, { x: 40, y: 96 }, { x: 96, y: 130 }, { x: 112, y: 184 }, { x: 84, y: 228 }, { x: 96, y: 268 }, { x: 140, y: 290 }, { x: 190, y: 260 }, { x: 216, y: 300 }]
  };
  SPL.loopR = mirrorX(SPL.loopL);
  SPL.topL = mirrorX(SPL.topR);
  SPL.chalAr = mirrorX(SPL.chalA);
  SPL.chalBr = mirrorX(SPL.chalB);
  SPL.chalCr = mirrorX(SPL.chalC);
  var ENTRY = {
    loopL: new Spline(SPL.loopL), loopR: new Spline(SPL.loopR),
    topL: new Spline(SPL.topL), topR: new Spline(SPL.topR)
  };
  var CHAL = [new Spline(SPL.chalA), new Spline(SPL.chalAr), new Spline(SPL.chalB), new Spline(SPL.chalBr), new Spline(SPL.chalC), new Spline(SPL.chalCr)];

  /* ---------- Formation ---------- */
  var ROWS_DEF = [
    { row: 0, items: [[1.5, "boss"], [3.5, "boss"], [5.5, "boss"], [7.5, "boss"]] },
    { row: 1, items: [[1, "butterfly"], [2, "butterfly"], [3, "butterfly"], [4, "butterfly"], [5, "butterfly"], [6, "butterfly"], [7, "butterfly"], [8, "butterfly"]] },
    { row: 2, items: [[1, "butterfly"], [2, "butterfly"], [3, "cham"], [4, "cham"], [5, "cham"], [6, "cham"], [7, "butterfly"], [8, "butterfly"]] },
    { row: 3, items: [[1, "bee"], [2, "bee"], [3, "bee"], [4, "bee"], [5, "bee"], [6, "bee"], [7, "bee"], [8, "bee"]] },
    { row: 4, items: [[0, "bee"], [1, "bee"], [2, "bee"], [3, "bee"], [4, "bee"], [5, "bee"], [6, "bee"], [7, "bee"], [8, "bee"], [9, "bee"]] }
  ];
  var TYPES = {
    bee:       { hp: 1, form: 50,  dive: 100, frames: ["bee1", "bee2"], pal: "bee", box: [8, 8] },
    butterfly: { hp: 1, form: 80,  dive: 160, frames: ["butterfly1", "butterfly2"], pal: "butterfly", box: [8, 7] },
    cham:      { hp: 1, form: 100, dive: 200, frames: ["cham1", "cham2"], pal: "chamA", box: [8, 8] },
    boss:      { hp: 2, form: 150, dive: 400, hitPts: 50, frames: ["boss1", "boss2"], pal: "boss", box: [9, 9] },
    fighter:   { hp: 1, form: 0, dive: 0, free: 1000, frames: ["fighter", "fighter"], pal: "captured", box: [8, 8] }
  };

  function formTop() { return G.state === "title" ? 100 : 40; }
  function slotX(e) { return 40 + e.col * 16; }
  function slotY(e) { return formTop() + e.row * 16; }
  function sway(row) { return Math.sin(G.t * 0.9 - row * 0.4) * 3.2; }
  function formXY(e) { return { x: slotX(e) + sway(e.row), y: slotY(e) }; }

  /* ---------- Globale Spiel-Status ---------- */
  var G = {
    state: "title", t: 0, animT: 0,
    score: 0, high: 20000, wave: 1, lives: 2, nextExtra: 20000,
    bannerT: 0, chal: false, perfect: true,
    diveT: 0, flagT: 0, spawnQueue: 0,
    clearT: 0, overT: 0, paused: false, demo: true,
    beamBoss: null, captured: 0, newHi: false
  };
  try { var hs = localStorage.getItem("galaga_high"); if (hs) G.high = +hs || 20000; } catch (e) {}

  var P = { x: CX, y: 264, alive: true, dual: false, capT: 0, capBoss: null, respawnT: 0, invT: 0, fireCd: 0, targetX: null };

  var enemies = [], pbul = [], ebul = [], fx = [], pop = [], flags = [], stars = [];
  for (var i = 0; i < 70; i++) stars.push({ x: rnd(0, W), y: rnd(0, H), v: rnd(6, 34), b: rnd(0.25, 1), tw: rnd(0, 6) });

  /* ---------- Eingabe ---------- */
  var keys = { left: false, right: false, fire: false };
  function tryStart() {
    SND.unlock();
    if (G.state === "title") beginGame();
  }
  window.addEventListener("keydown", function (e) {
    var c = e.code;
    if (c === "ArrowLeft" || c === "KeyA") { keys.left = true; P.targetX = null; }
    else if (c === "ArrowRight" || c === "KeyD") { keys.right = true; P.targetX = null; }
    else if (c === "Space") { keys.fire = true; if (G.state === "title") tryStart(); }
    else if (c === "Enter" || c === "NumpadEnter") { if (G.state === "title") tryStart(); }
    else if (c === "KeyP") { togglePause(); }
    else if (c === "KeyM") { setMuted(SND.toggle()); }
    if (c === "Space" || c === "ArrowLeft" || c === "ArrowRight" || c === "ArrowUp" || c === "ArrowDown") e.preventDefault();
    SND.unlock();
  });
  window.addEventListener("keyup", function (e) {
    var c = e.code;
    if (c === "ArrowLeft" || c === "KeyA") keys.left = false;
    else if (c === "ArrowRight" || c === "KeyD") keys.right = false;
    else if (c === "Space") keys.fire = false;
  });

  /* Zeiger-/Touch-Steuerung: auf dem Spielfeld ziehen = Schiff bewegen */
  var dragging = false;
  function ptrX(e) {
    var r = canvas.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width * W, 8, W - 8);
  }
  canvas.addEventListener("pointerdown", function (e) {
    dragging = true; P.targetX = ptrX(e);
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    tryStart();
  });
  canvas.addEventListener("pointermove", function (e) { if (dragging) P.targetX = ptrX(e); });
  canvas.addEventListener("pointerup", function () { dragging = false; P.targetX = null; });
  canvas.addEventListener("pointercancel", function () { dragging = false; P.targetX = null; });

  /* Touch-Buttons */
  function hold(id, on, off) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("pointerdown", function (e) { e.preventDefault(); on(); });
    el.addEventListener("pointerup", off);
    el.addEventListener("pointerleave", off);
    el.addEventListener("pointercancel", off);
  }
  hold("btnLeft", function () { keys.left = true; }, function () { keys.left = false; });
  hold("btnRight", function () { keys.right = true; }, function () { keys.right = false; });
  hold("btnFire", function () { keys.fire = true; tryStart(); }, function () { keys.fire = false; });
  var bStart = document.getElementById("btnStart"), bPause = document.getElementById("btnPause");
  if (bStart) bStart.addEventListener("pointerdown", function (e) { e.preventDefault(); tryStart(); });
  if (bPause) bPause.addEventListener("pointerdown", function (e) { e.preventDefault(); togglePause(); });
  if ("ontouchstart" in window || (window.matchMedia && window.matchMedia("(pointer:coarse)").matches)) {
    var t = document.getElementById("touch"); if (t) t.classList.remove("hide");
  }
  var muteBadge = 0;
  function setMuted(m) { muteBadge = m ? 2 : 0; }

  function togglePause() {
    if (G.state === "play" || G.state === "dying") G.paused = !G.paused;
    if (G.paused) SND.stopBeam();
  }

  /* ---------- Aufbau einer Welle ---------- */
  function makeEnemy(type, col, row) {
    return {
      type: type, col: col, row: row, x: 0, y: 0,
      state: "wait", startT: 0, path: null, dist: 0, speed: 150,
      hp: TYPES[type].hp, flashT: 0, shootAt: null, fired: null,
      dir: 1, beamT: 0, carry: false, hx: 0,
      bobT: rnd(0, 6), shootT: rnd(1.4, 3), diveT: rnd(4, 9), pal: null
    };
  }
  function queueEntry(e, startT, path, speed) {
    e.startT = startT; e.path = path; e.speed = speed || 150;
    var p0 = path.s[0]; e.x = p0.x; e.y = p0.y;
    enemies.push(e);
  }
  function buildWave(n, chal) {
    /* überlebende gefangene Kämpfer bleiben über Wellen hinweg erhalten */
    var keep = [];
    for (var ki = 0; ki < enemies.length; ki++)
      if (enemies[ki].type === "fighter") keep.push(enemies[ki]);
    enemies = keep;
    flags = []; G.beamBoss = null; G.spawnQueue = 0;
    var idx = 0;
    for (var r = 0; r < ROWS_DEF.length; r++) {
      var items = ROWS_DEF[r].items;
      for (var i = 0; i < items.length; i++) {
        var col = items[i][0], type = items[i][1];
        var e = makeEnemy(type, col, r);
        if (chal) {
          e.state = "wait";
          var grp = Math.floor(idx / 8) % CHAL.length;
          var startT = G.t + 0.5 + Math.floor(idx / 8) * 2.4 + (idx % 8) * 0.16;
          queueEntry(e, startT, CHAL[grp], 175);
          G.spawnQueue++;
        } else {
          var base, step, path;
          if (r === 0)      { base = 0.4; step = 0.6;  path = (i % 2 ? ENTRY.topL : ENTRY.topR); }
          else if (r === 1) { base = 3.0; step = 0.14; path = (i % 2 ? ENTRY.topR : ENTRY.topL); }
          else if (r === 2) { base = 4.3; step = 0.14; path = (i % 2 ? ENTRY.topL : ENTRY.topR); }
          else if (r === 3) { base = 5.6; step = 0.12; path = (i % 2 ? ENTRY.loopL : ENTRY.loopR); }
          else              { base = 6.8; step = 0.12; path = (i % 2 ? ENTRY.loopR : ENTRY.loopL); }
          queueEntry(e, G.t + base + i * step, path, 165);
          G.spawnQueue++;
        }
        idx++;
      }
    }
    G.diveT = chal ? 99 : (n === 1 ? 8.5 : 6.0);
    G.flagT = rnd(9, 15);
  }
  function buildTitleFormation() {
    enemies = [];
    for (var r = 0; r < ROWS_DEF.length; r++)
      for (var i = 0; i < ROWS_DEF[r].items.length; i++) {
        var it = ROWS_DEF[r].items[i];
        var e = makeEnemy(it[1], it[0], r);
        e.state = "form";
        var f = formXY(e); e.x = f.x; e.y = f.y;
        enemies.push(e);
      }
    G.diveT = 2.5;
  }

  function startWave(n) {
    G.wave = n;
    G.chal = (n % 4 === 3);
    G.perfect = true;
    buildWave(n, G.chal);
    if (G.chal) { SND.startChallenge(); G.bannerT = 3.0; }
    else { SND.waveTune(); G.bannerT = 1.7; }
  }

  function beginGame() {
    G.demo = false; G.score = 0; G.wave = 0; G.lives = 2;
    G.nextExtra = 20000; G.newHi = false; G.captured = 0;
    enemies = []; flags = [];
    pbul = []; ebul = []; fx = []; pop = [];
    P.x = CX; P.dual = false; P.alive = true; P.capT = 0; P.capBoss = null;
    P.respawnT = 0; P.invT = 1.2; P.targetX = null;
    G.state = "ready"; G.bannerT = 1.6;
    SND.pop();
  }

  function backToTitle() {
    SND.stopChallenge(); SND.stopBeam();
    G.state = "title"; G.demo = true; G.chal = false; G.captured = 0;
    G.score = 0; G.lives = 2; G.wave = 1; G.nextExtra = 20000; G.perfect = true;
    pbul = []; ebul = []; fx = []; pop = []; flags = [];
    P.alive = true; P.dual = false; P.capT = 0; P.x = CX; P.targetX = null;
    G.t = 0;
    buildTitleFormation();
  }

  /* ---------- Effekte & Popups ---------- */
  function boomFx(x, y, scale, playerish) {
    fx.push({ kind: "exp", x: x, y: y, t: 0, dur: playerish ? 0.9 : 0.36, scale: scale || 1, frames: ["boom1", "boom2", "boom3"] });
  }
  function popup(x, y, s, color) { pop.push({ x: x, y: y, txt: s, color: color || "#ffffff", t: 0 }); }

  function addScore(v, x, y, color) {
    G.score += v;
    if (x != null) popup(x, y, String(v), color);
    while (G.score >= G.nextExtra) {
      G.lives++; G.nextExtra += 60000;
      SND.extraLife(); popup(CX, 150, "EXTRA FIGHTER!", "#3fd8ff");
    }
    if (G.score > G.high) {
      G.high = G.score; G.newHi = true;
      try { localStorage.setItem("galaga_high", String(G.high)); } catch (e) {}
    }
  }

  /* ---------- Angriffs-Pfade ---------- */
  function divePath(e, loop) {
    var s = { x: e.x, y: e.y };
    var dir = s.x < CX ? 1 : -1;
    var tx = clamp((P.alive ? P.x : CX) + rnd(-40, 40), 20, W - 20);
    var pts = [s];
    if (loop) {
      var cx = s.x + dir * 26, cy = s.y + 30, rr = 22;
      var a0 = Math.atan2(s.y - cy, s.x - cx);
      for (var k = 0; k <= 5; k++) {
        var a = a0 + dir * Math.PI * 1.6 * (k / 5);
        pts.push({ x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) });
      }
    }
    pts.push({ x: s.x + dir * 20, y: Math.max(s.y + 4, 120) });
    pts.push({ x: (s.x + tx) / 2, y: 175 });
    pts.push({ x: tx, y: 226 });
    pts.push({ x: clamp(tx - dir * 36, 6, W - 6), y: H + 26 });
    return new Spline(pts);
  }
  function beamPath(e) {
    var s = { x: e.x, y: e.y };
    var dir = s.x < CX ? 1 : -1;
    var hx = clamp(P.alive ? P.x : CX, 44, W - 44), hy = 158;
    e.hx = hx;
    return new Spline([s,
      { x: s.x + dir * 24, y: s.y + 16 },
      { x: s.x + dir * 38, y: 118 },
      { x: hx + dir * 16, y: 146 },
      { x: hx, y: hy }]);
  }
  function joinPath(e) {
    return new Spline([
      { x: e.x, y: e.y },
      { x: clamp(e.x + rnd(-30, 30), 16, W - 16), y: 200 },
      { x: clamp((P.alive ? P.x : CX) + rnd(-16, 16), 16, W - 16), y: 244 }
    ]);
  }

  /* ---------- Sturzangriffe ---------- */
  function launchDive(e) {
    var isBoss = e.type === "boss";
    var loop = Math.random() < 0.55;
    if (isBoss && G.wave >= 2 && !G.demo && !G.beamBoss && G.captured < 2 && Math.random() < 0.25) {
      e.path = beamPath(e); e.dist = 0; e.state = "dive"; e.beamIntent = true;
      e.speed = 150; e.shootAt = [0.3]; e.fired = [false];
    } else {
      e.path = divePath(e, loop); e.dist = 0; e.state = "dive"; e.beamIntent = false;
      e.speed = 130 + G.wave * 4 + rnd(-10, 20);
      e.shootAt = [0.42, 0.66]; e.fired = [false, false];
    }
    e.beamT = 0;
  }
  function activeDivers() {
    var n = 0;
    for (var i = 0; i < enemies.length; i++)
      if (enemies[i].state === "dive" || enemies[i].state === "beam") n++;
    return n;
  }
  function formationCount() {
    var n = 0;
    for (var i = 0; i < enemies.length; i++)
      if (enemies[i].state === "form") n++;
    return n;
  }
  function diveScheduler(dt) {
    if (G.chal) return;
    G.diveT -= dt;
    if (G.diveT > 0) return;
    var maxDivers = Math.min(1 + Math.floor(G.wave / 3), 4);
    if (activeDivers() < maxDivers) {
      var pool = enemies.filter(function (e) { return e.state === "form"; });
      if (pool.length) {
        var count = Math.min(pool.length, irnd(1, Math.min(1 + Math.floor(G.wave / 3), 3)));
        for (var c = 0; c < count; c++) {
          var pick = pool.splice(irnd(0, pool.length - 1), 1)[0];
          launchDive(pick);
        }
      }
    }
    G.diveT = clamp(3.3 - G.wave * 0.12, 1.1, 3.3) * rnd(0.75, 1.4);
  }

  /* ---------- Gefangener Kämpfer ---------- */
  function freeFighterSlot() {
    for (var r = ROWS_DEF.length - 1; r >= 0; r--)
      for (var c = 0; c <= 9; c++) {
        var taken = false;
        for (var i = 0; i < enemies.length; i++)
          if (enemies[i].row === r && Math.abs(enemies[i].col - c) < 0.1 &&
              (enemies[i].state !== "gone")) { taken = true; break; }
        if (!taken) return { row: r, col: c };
      }
    return { row: ROWS_DEF.length - 1, col: 4.5 };
  }
  function spawnCapturedFighter() {
    var slot = freeFighterSlot();
    var e = makeEnemy("fighter", slot.col, slot.row);
    e.state = "capform";
    e.x = slotX(e); e.y = slotY(e);
    enemies.push(e);
    SND.pop();
  }
  function capturedCount() {
    var n = 0;
    for (var i = 0; i < enemies.length; i++)
      if (enemies[i].type === "fighter") n++;
    return n;
  }

  /* ---------- Gefangennahme des Spielers ---------- */
  function startCapture(boss) {
    SND.stopBeam(); G.beamBoss = null;
    P.capT = 0.01; P.capBoss = boss; P.targetX = null;
    SND.capture();
  }
  function captureDone() {
    var boss = P.capBoss; P.capBoss = null; P.capT = 0;
    G.captured++;
    P.y = 264;
    boss.carry = true; boss.state = "home";
    if (P.dual) {
      /* eines der beiden Schiffe wurde gefangen – der Rest fliegt weiter */
      P.dual = false; P.invT = 1.5;
    } else {
      P.alive = false;
      if (!G.demo) {
        G.lives--;
        if (G.lives < 0) { gameOver(); return; }
        P.respawnT = 1.4;
      }
    }
  }
  function loseFighterToCapture() { /* veraltet – Fanglebens-Logik jetzt in captureDone() */ }
  function gameOver() {
    G.state = "over"; G.overT = 4.2;
    SND.stopChallenge(); SND.stopBeam();
    SND.gameOver();
  }

  /* ---------- Spieler-Tod ---------- */
  function killPlayer() {
    if (!P.alive || P.capT > 0 || P.invT > 0 || G.demo) return;
    boomFx(P.x, P.y, 2, true);
    SND.playerDie();
    if (P.dual) {
      P.dual = false; P.invT = 1.6;
      G.perfect = false;
      return; /* ein Fighter geopfert, aber kein Reserve-Verlust */
    }
    P.alive = false;
    G.lives--; G.perfect = false;
    if (G.lives < 0) { gameOver(); return; }
    P.respawnT = 1.6;
  }

  /* ---------- Update: Feinde ---------- */
  function updateEnemies(dt) {
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i], tp = TYPES[e.type];
      if (e.flashT > 0) e.flashT -= dt;

      switch (e.state) {
        case "gone": enemies.splice(i, 1); continue;

        case "wait":
          if (G.t >= e.startT) { e.state = "entry"; e.dist = 0; }
          break;

        case "entry":
          e.dist += e.speed * dt;
          var p = e.path.at(e.dist);
          e.x = p.x; e.y = p.y;
          if (G.chal) {
            if (e.dist >= e.path.len) {
              if (Math.random() < 0.75) { addScore(tp.dive, e.x, e.y, "#ffd21f"); SND.eboom(); }
              boomFx(e.x, e.y, 1);
              enemies.splice(i, 1);
            }
          } else if (e.dist >= e.path.len) e.state = "home";
          break;

        case "home": {
          var f = formXY(e), dx = f.x - e.x, dy = f.y - e.y, dl = Math.hypot(dx, dy);
          var sp = 175 * dt;
          if (dl <= sp + 1) {
            e.x = f.x; e.y = f.y; e.state = "form"; e.flashT = 0.12; SND.click();
            if (e.carry) { e.carry = false; spawnCapturedFighter(); }
          } else { e.x += dx / dl * sp; e.y += dy / dl * sp; }
          break;
        }

        case "form": {
          var q = formXY(e); e.x = q.x; e.y = q.y;
          break;
        }

        case "dive":
          e.dist += e.speed * dt;
          var p2 = e.path.at(e.dist);
          e.x = p2.x; e.y = p2.y;
          if (e.shootAt) for (var s2 = 0; s2 < e.shootAt.length; s2++)
            if (!e.fired[s2] && e.dist / e.path.len > e.shootAt[s2]) {
              e.fired[s2] = true;
              if (!G.demo) enemyShoot(e);
            }
          if (e.dist >= e.path.len) {
            if (e.beamIntent) {
              e.state = "beam"; e.beamT = 2.8; e.beamIntent = false;
              G.beamBoss = e; SND.startBeam();
            } else if (G.chal) {
              boomFx(e.x, e.y, 1); enemies.splice(i, 1);
            } else {
              e.state = "return"; e.y = -16; e.x = slotX(e);
            }
          }
          break;

        case "beam":
          e.beamT -= dt;
          e.x = e.hx + Math.sin(G.t * 8) * 1.5;
          if (P.alive && P.capT <= 0 && P.invT <= 0 && !G.demo) {
            var bt = e.y + 10, hw = 3 + (P.y - bt) * 0.17;
            if (P.y > bt && Math.abs(P.x - e.x) < hw) startCapture(e);
          }
          if (e.beamT <= 0) {
            SND.stopBeam();
            if (G.beamBoss === e) G.beamBoss = null;
            e.state = "home";
          }
          break;

        case "return":
          e.y += 150 * dt;
          e.x = slotX(e) + sway(e.row) * 0.3;
          if (e.y >= slotY(e)) { e.state = "form"; e.flashT = 0.12; }
          break;

        case "capform": {
          e.bobT += dt;
          e.x = slotX(e) + sway(e.row);
          e.y = slotY(e) + Math.sin(e.bobT * 5) * 5;
          e.shootT -= dt;
          if (e.shootT <= 0 && P.alive) { e.shootT = rnd(1.2, 2.4); enemyShoot(e); }
          e.diveT -= dt;
          if (e.diveT <= 0) {
            e.diveT = rnd(6, 11);
            e.path = divePath(e, false); e.dist = 0; e.state = "capdive";
            e.speed = 150; e.shootAt = [0.4, 0.7]; e.fired = [false, false];
          }
          break;
        }

        case "capdive":
          e.dist += e.speed * dt;
          var p3 = e.path.at(e.dist);
          e.x = p3.x; e.y = p3.y;
          if (e.shootAt) for (var s3 = 0; s3 < e.shootAt.length; s3++)
            if (!e.fired[s3] && e.dist / e.path.len > e.shootAt[s3]) {
              e.fired[s3] = true; enemyShoot(e);
            }
          if (e.dist >= e.path.len) { e.state = "return"; e.y = -16; e.x = slotX(e); }
          break;

        case "join":
          if (e.dist < e.path.len) {
            e.dist += 170 * dt;
            var jp = e.path.at(e.dist);
            e.x = jp.x; e.y = jp.y;
          } else {
            var tX = P.alive ? P.x : CX, tY = P.alive ? P.y : 240;
            var ddx = tX - e.x, ddy = tY - e.y, ddl = Math.hypot(ddx, ddy);
            if (ddl < 5) {
              P.dual = true;
              SND.rescue();
              enemies.splice(i, 1);
              continue;
            }
            e.x += ddx / ddl * 190 * dt; e.y += ddy / ddl * 190 * dt;
          }
          break;
      }
    }
  }

  function enemyShoot(e) {
    if (!P.alive || G.state === "clear") return;
    var dx = P.x - e.x, dy = P.y - e.y, dl = Math.hypot(dx, dy) || 1;
    var sp = 95 + G.wave * 3;
    ebul.push({ x: e.x, y: e.y + 6, vx: dx / dl * sp, vy: Math.max(45, dy / dl * sp) });
    SND.eshoot();
  }

  /* ---------- Update: Spieler ---------- */
  function updatePlayer(dt) {
    if (P.invT > 0) P.invT -= dt;
    if (P.capT > 0) {
      P.capT += dt / 1.7;
      var b = P.capBoss;
      if (b) {
        P.x += (b.x - P.x) * Math.min(1, dt * 5);
        P.y += (b.y + 12 - P.y) * Math.min(1, dt * 5);
      }
      if (P.capT >= 1) captureDone();
      return;
    }
    if (!P.alive) {
      if (P.respawnT > 0) {
        P.respawnT -= dt;
        if (P.respawnT <= 0 && (G.state === "play" || G.state === "dying" || G.state === "clear" || G.state === "banner")) {
          P.alive = true; P.x = CX; P.y = 264; P.invT = 1.6;
        }
      }
      return;
    }

    if (G.demo) { P.x = CX + Math.sin(G.t * 0.8) * 72; return; }

    var sp = 150 * dt;
    if (keys.left) P.x -= sp;
    if (keys.right) P.x += sp;
    if (P.targetX != null) {
      var d = P.targetX - P.x;
      P.x += clamp(d, -sp * 1.4, sp * 1.4);
    }
    P.x = clamp(P.x, 10, W - 10);

    P.fireCd -= dt;
    var maxB = P.dual ? 4 : 2;
    if (keys.fire && P.fireCd <= 0 && pbul.length < maxB &&
        (G.state === "play" || G.state === "dying")) {
      P.fireCd = 0.22;
      pbul.push({ x: P.x + (P.dual ? -9 : 0), y: P.y - 10, vy: -300 });
      if (P.dual) pbul.push({ x: P.x + 9, y: P.y - 10, vy: -300 });
      SND.shoot();
    }
  }

  /* ---------- Kollisionen ---------- */
  function hitBox(e) { return TYPES[e.type].box; }
  function canHit(e) {
    return e.state === "form" || e.state === "entry" || e.state === "home" ||
           e.state === "dive" || e.state === "return" || e.state === "beam" ||
           e.state === "capform" || e.state === "capdive" || e.state === "challenge";
  }
  function pointsFor(e) {
    var tp = TYPES[e.type];
    if (e.type === "fighter") return tp.free;
    var diving = (e.state === "dive" || e.state === "beam" || e.state === "entry" ||
                  e.state === "return" || e.state === "capdive" || e.state === "challenge");
    return diving ? tp.dive : tp.form;
  }

  function updateShots(dt) {
    var i, j;
    for (i = pbul.length - 1; i >= 0; i--) {
      var b = pbul[i];
      b.y += b.vy * dt;
      if (b.y < -8) { pbul.splice(i, 1); continue; }
      var gone = false;
      for (j = 0; j < flags.length && !gone; j++) {
        var fl = flags[j];
        if (Math.abs(b.x - fl.x) < 8 && Math.abs(b.y - fl.y) < 9) {
          addScore(800, fl.x, fl.y, "#ffd21f");
          SND.flagHit(); boomFx(fl.x, fl.y, 1);
          flags.splice(j, 1); pbul.splice(i, 1); gone = true;
        }
      }
      if (gone) continue;
      for (j = 0; j < enemies.length; j++) {
        var e = enemies[j];
        if (!canHit(e)) continue;
        var hb = hitBox(e);
        if (Math.abs(b.x - e.x) < hb[0] && Math.abs(b.y - e.y) < hb[1]) {
          pbul.splice(i, 1);
          hitEnemy(e);
          break;
        }
      }
    }
    for (i = ebul.length - 1; i >= 0; i--) {
      var eb = ebul[i];
      eb.x += eb.vx * dt; eb.y += eb.vy * dt;
      if (eb.y > H + 8 || eb.x < -8 || eb.x > W + 8) { ebul.splice(i, 1); continue; }
      if (P.alive && P.capT <= 0 && P.invT <= 0 && !G.demo &&
          Math.abs(eb.x - P.x) < 7 && Math.abs(eb.y - P.y) < 9) {
        ebul.splice(i, 1);
        killPlayer();
      }
    }
    if (!G.demo && P.alive && P.capT <= 0 && P.invT <= 0) {
      for (i = 0; i < enemies.length; i++) {
        var en = enemies[i];
        if (en.state !== "dive" && en.state !== "capdive") continue;
        if (Math.abs(en.x - P.x) < 9 && Math.abs(en.y - P.y) < 11) {
          enemyKilled(en, false);
          killPlayer();
          break;
        }
      }
    }
  }

  function hitEnemy(e) {
    var tp = TYPES[e.type];
    if (e.type === "fighter") {
      /* gefangenen Kämpfer befreit */
      e.state = "join"; e.path = joinPath(e); e.dist = 0;
      G.captured = Math.max(0, G.captured - 1);
      addScore(tp.free, e.x, e.y, "#3fd8ff");
      SND.rescue();
      return;
    }
    e.hp--;
    if (e.hp > 0) {
      e.flashT = 0.25;
      addScore(tp.hitPts || 50, e.x, e.y, "#ffffff");
      SND.pop();
      return;
    }
    enemyKilled(e, true);
  }
  function enemyKilled(e, byPlayer) {
    if (byPlayer) {
      addScore(pointsFor(e), e.x, e.y);
      SND.eboom();
      if (e.carry) { boomFx(e.x, e.y + 12, 1); G.captured = Math.max(0, G.captured - 1); }
    }
    e.carry = false;
    if (G.beamBoss === e) { G.beamBoss = null; SND.stopBeam(); }
    boomFx(e.x, e.y, 1);
    enemies.splice(enemies.indexOf(e), 1);
  }

  /* ---------- Flaggen ---------- */
  function updateFlags(dt) {
    if (!G.demo && !G.chal && G.state === "play") {
      G.flagT -= dt;
      if (G.flagT <= 0) {
        G.flagT = rnd(11, 17);
        var fromLeft = Math.random() < 0.5;
        flags.push({ x: fromLeft ? -12 : W + 12, y: rnd(204, 236), vx: fromLeft ? 42 : -42 });
      }
    }
    for (var i = flags.length - 1; i >= 0; i--) {
      flags[i].x += flags[i].vx * dt;
      if (flags[i].x < -20 || flags[i].x > W + 20) flags.splice(i, 1);
    }
  }

  /* ---------- Wellen-Ende & Zustandsautomat ---------- */
  function checkWaveEnd() {
    if (G.state !== "play") return;
    var foes = 0;
    for (var i = 0; i < enemies.length; i++)
      if (enemies[i].type !== "fighter") foes++;
    if (foes === 0) {
      SND.stopChallenge();
      var bonus = 100 * G.wave;
      G.score += bonus;
      if (G.chal && G.perfect) { bonus += 5000; popup(CX, 120, "PERFECT +5000", "#ffd21f"); }
      popup(CX, 150, "WAVE BONUS " + bonus, "#3fd8ff");
      G.state = "clear"; G.clearT = 2.4;
    }
  }

  /* ---------- Sterne ---------- */
  function updateStars(dt) {
    var boost = G.chal ? 2.2 : 1;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.y += s.v * boost * dt;
      if (s.y > H) { s.y = -1; s.x = rnd(0, W); }
    }
  }

  /* ---------- Haupt-Update ---------- */
  function update(dt) {
    G.animT += dt;
    if (muteBadge > 0) muteBadge--;
    updateStars(dt);

    if (G.paused) return;
    G.t += dt;

    switch (G.state) {
      case "title":
        updateEnemies(dt); diveScheduler(dt); updatePlayer(dt); updateFlags(dt);
        break;

      case "ready":
        G.bannerT -= dt;
        if (G.bannerT <= 0) { G.state = "banner"; startWave(1); }
        break;

      case "banner":
        G.bannerT -= dt;
        updateEnemies(dt); updatePlayer(dt);
        if (G.bannerT <= 0) G.state = "play";
        break;

      case "play":
        updateEnemies(dt); diveScheduler(dt); updatePlayer(dt);
        updateShots(dt); updateFlags(dt); checkWaveEnd();
        break;

      case "dying":
        updateEnemies(dt); updatePlayer(dt); updateShots(dt);
        if (P.alive) G.state = "play";
        break;

      case "clear":
        G.clearT -= dt;
        updatePlayer(dt);
        if (G.clearT <= 0) { G.state = "banner"; startWave(G.wave + 1); }
        break;

      case "over":
        G.overT -= dt;
        updateEnemies(dt);
        if (G.overT <= 0) backToTitle();
        break;
    }
    if (!P.alive && P.respawnT > 0 && G.state === "play") G.state = "dying";

    /* Effekte & Popups */
    for (var i = fx.length - 1; i >= 0; i--) {
      fx[i].t += dt;
      if (fx[i].t > fx[i].dur) fx.splice(i, 1);
    }
    for (var j = pop.length - 1; j >= 0; j--) {
      pop[j].t += dt; pop[j].y -= 14 * dt;
      if (pop[j].t > 0.9) pop.splice(j, 1);
    }
  }

  /* ---------- Zeichnen ---------- */
  function drawStars() {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = s.b * (0.7 + 0.3 * Math.sin(G.animT * 3 + s.tw));
      ctx.fillStyle = "rgba(255,255,255," + a.toFixed(2) + ")";
      ctx.fillRect(s.x | 0, s.y | 0, 1, 1);
    }
  }

  function enemySprites(e) {
    var tp = TYPES[e.type];
    var flapFast = (e.state === "entry" || e.state === "home" || e.state === "dive" || e.state === "capdive" || e.state === "join");
    var fi = ((G.animT * (flapFast ? 9 : 3.5) + e.bobT) | 0) % 2;
    var name = tp.frames[fi];
    var pal = tp.pal;
    if (e.type === "cham") pal = ["chamA", "chamB", "chamC"][((G.animT * 1.6) | 0) % 3];
    if (e.type === "boss" && e.hp < tp.hp) pal = "bossHit";
    if (e.flashT > 0 && ((G.animT * 24) | 0) % 2) pal = "flash";
    if (e.type === "fighter" && ((G.animT * 10) | 0) % 2) pal = "captured";
    return { name: name, pal: pal };
  }

  function drawRotated(name, pal, cx, cy, ang) {
    var s = PX.sprite(name, pal);
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    ctx.rotate(ang);
    ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2);
    ctx.restore();
  }

  function drawBeam(e) {
    var top = e.y + 10, len = 108, seg = 3;
    for (var y = 0; y < len; y += seg) {
      var hw = 3 + y * 0.24;
      var col = ["#3fd8ff", "#c050ff", "#2b57ff", "#ffffff"][(((y / seg + G.animT * 9) | 0) % 4)];
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(Math.round(e.x - hw), Math.round(top + y), Math.round(hw * 2), 1);
    }
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#3fd8ff";
    ctx.beginPath();
    ctx.moveTo(e.x - 4, top);
    ctx.lineTo(e.x + 4, top);
    ctx.lineTo(e.x + 3 + len * 0.24, top + len);
    ctx.lineTo(e.x - 3 - len * 0.24, top + len);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    if (!P.alive) return;
    if (P.invT > 0 && ((G.animT * 12) | 0) % 2 && P.capT <= 0) return; /* blinken */
    if (P.capT > 0) {
      drawRotated("fighter", "captured", P.x, P.y, P.capT * Math.PI * 4);
      return;
    }
    if (P.dual) {
      drawSpr("fighter", "fighter", P.x - 9, P.y);
      drawSpr("fighter", "captured", P.x + 9, P.y);
    } else {
      drawSpr("fighter", "fighter", P.x, P.y);
    }
  }

  function drawHUD() {
    txt("HIGH SCORE", 12, 6, "#ff2b2b");
    txt(String(G.high), 12, 16, "#ffffff");
    txt("1UP", CX, 6, "#ffd21f", { align: "center" });
    txt(String(G.score), CX, 16, "#ffd21f", { align: "center" });
    txt("SCORE", W - 12, 6, "#3fd8ff", { align: "right" });
    if (G.newHi && ((G.animT * 4) | 0) % 2) txt("NEW", W - 12, 16, "#ff2b2b", { align: "right" });
    else txt(String(G.score), W - 12, 16, "#ffffff", { align: "right" });

    for (var i = 0; i < Math.min(G.lives, 6); i++) drawSpr("fighter", "fighter", 12 + i * 18, 274);
    if (G.state !== "title") txt("WAVE " + G.wave, W - 8, 272, "#2bff6e", { align: "right" });
    if (SND.isMuted()) txt("SOUND OFF", CX, 272, "#8a8fa3", { align: "center" });
    else if (muteBadge > 0) txt("SOUND ON", CX, 272, "#2bff6e", { align: "center" });
  }

  function drawBanner() {
    if (G.state === "ready") {
      txt("PLAYER 1", CX, 140, ((G.animT * 4) | 0) % 2 ? "#ffffff" : "#ffd21f", { align: "center", scale: 2 });
    } else if (G.state === "banner") {
      if (G.chal) {
        txt("CHALLENGING STAGE", CX, 130, ((G.animT * 6) | 0) % 2 ? "#ff2b2b" : "#ffd21f", { align: "center", scale: 2 });
        txt("SHOOT THEM ALL!", CX, 152, "#3fd8ff", { align: "center" });
      } else {
        txt("WAVE " + G.wave, CX, 140, "#ffffff", { align: "center", scale: 3 });
      }
    }
    if (G.state === "over") {
      txt("GAME OVER", CX, 132, "#ff2b2b", { align: "center", scale: 2 });
      if (G.newHi) txt("NEW HIGH SCORE!", CX, 158, ((G.animT * 4) | 0) % 2 ? "#ffd21f" : "#ffffff", { align: "center" });
    }
  }

  function drawTitle() {
    txt("GALAGA", CX + 2, 42, "#ff2b2b", { align: "center", scale: 4, tracking: 2 });
    txt("GALAGA", CX, 40, "#ffd21f", { align: "center", scale: 4, tracking: 2 });
    txt("WEB ARCADE EDITION", CX, 82, "#3fd8ff", { align: "center", tracking: 1 });
    if (((G.animT * 2) | 0) % 2)
      txt("PRESS ENTER OR FIRE TO START", CX, 200, "#ffffff", { align: "center" });
    txt("PFEILTASTEN / MAUS / TOUCH: BEWEGEN", CX, 222, "#8a8fa3", { align: "center" });
    txt("LEERTASTE: FEUER   P: PAUSE   M: TON", CX, 234, "#8a8fa3", { align: "center" });
    txt("HOMMAGE AN NAMCO 1981", CX, 252, "#4a4f63", { align: "center" });
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawStars();

    /* Flaggen */
    for (var f = 0; f < flags.length; f++) drawSpr("flag", "flag", flags[f].x, flags[f].y);

    /* Traktorstrahlen unter den Gegnern */
    for (var bi = 0; bi < enemies.length; bi++)
      if (enemies[bi].state === "beam") drawBeam(enemies[bi]);

    /* Gegner */
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.state === "wait") continue;
      if (e.y < -20 || e.y > H + 20) continue;
      var spr = enemySprites(e);
      drawSpr(spr.name, spr.pal, e.x, e.y);
    }

    /* Projektile */
    ctx.fillStyle = "#ffffff";
    for (var pb = 0; pb < pbul.length; pb++) {
      var b2 = pbul[pb];
      ctx.fillRect(b2.x | 0, (b2.y - 5) | 0, 1, 5);
      ctx.fillStyle = "#ff2b2b";
      ctx.fillRect(b2.x | 0, (b2.y - 5) | 0, 1, 1);
      ctx.fillStyle = "#ffffff";
    }
    for (var eb2 = 0; eb2 < ebul.length; eb2++) {
      var z = ebul[eb2], w = ((G.animT * 12) | 0) & 1;
      ctx.fillStyle = "#ff2b2b"; ctx.fillRect((z.x - 1 + (w ? 0 : 1)) | 0, (z.y - 3) | 0, 2, 3);
      ctx.fillStyle = "#ffd21f"; ctx.fillRect((z.x - 1 + (w ? 1 : 0)) | 0, z.y | 0, 2, 3);
    }

    drawPlayer();

    /* Explosionen */
    for (var fx2 = 0; fx2 < fx.length; fx2++) {
      var ex = fx[fx2];
      var fr = clamp((ex.t / ex.dur * 3) | 0, 0, 2);
      drawSpr(ex.frames[fr], null, ex.x, ex.y, { scale: ex.scale });
    }

    /* Score-Popups */
    for (var p2i = 0; p2i < pop.length; p2i++) {
      var pp = pop[p2i];
      txt(pp.txt, pp.x, pp.y, pp.color, { align: "center" });
    }

    drawHUD();

    if (G.state === "title") drawTitle();
    else drawBanner();

    if (G.paused) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 120, W, 48);
      txt("PAUSE", CX, 138, "#ffffff", { align: "center", scale: 2 });
      txt("P WEITER", CX, 158, "#8a8fa3", { align: "center" });
    }

    /* Output auf sichtbares Canvas */
    ctx.imageSmoothingEnabled = false;
  }

  /* ---------- main loop ---------- */
  var last = 0, acc = 0;
  var STEP = 1 / 60;
  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    draw();
    requestAnimationFrame(loop);
  }

  buildTitleFormation();
  fit();

  if (window.__GALAGA_AUTOTEST) {
    window.__GALAGA_DEBUG = {
      update: update, draw: draw, beginGame: beginGame, backToTitle: backToTitle,
      startWave: startWave, launchDive: launchDive, G: G, P: P,
      enemies: function () { return enemies; }, keys: keys,
      pbul: function () { return pbul; }, ebul: function () { return ebul; },
      hitEnemy: function (e) { hitEnemy(e); },
      addScore: addScore, spawnCapturedFighter: spawnCapturedFighter,
      startCapture: startCapture
    };
  } else {
    requestAnimationFrame(loop);
  }
})();
