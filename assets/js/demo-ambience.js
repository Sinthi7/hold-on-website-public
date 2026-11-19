/* HOLD ON: Through Time — Bilder rund um die Browser-Demo (nur Startseite, nur Zeichnen, kein Spielcode, kein Ton).
   1. Vorschau (#demo-preview): gezeichneter Urozean wie im Spiel (Farbverlauf, Lichtflecken, Blasen, rote Wände).
      Läuft nur, bis die echte Demo bereit ist (setPreview(false)).
   2. Seiten (#demo-ambience): halbtransparente Motive links und rechts der Spalte, passend zum Zeitalter:
      0 Urozean: Blasen · 1 Erste Zellen: Zellformen · 2 Leben im Meer: Quallen und Meeresschnee.
   Sparsam: höchstens ~30 Bilder/s, nur wenn das Feld sichtbar und der Tab aktiv ist, Pixeldichte höchstens 1,5,
   keine Seitenmotive bei schmalen Seiten (Handy). Bewegungsreduktion oder Datensparmodus: ein ruhiges Standbild.
   Schnittstelle für demo-embed.js: window.HoldOnDemoVisuals.setEpoch(index), .setPreview(on). */
(function () {
  'use strict';

  var stage = document.getElementById('demo-stage');
  var ambCanvas = document.getElementById('demo-ambience');
  var prevCanvas = document.getElementById('demo-preview');
  var column = document.getElementById('demo-column');
  if (!stage || !ambCanvas || !prevCanvas || !column || !ambCanvas.getContext) return;

  var amb = ambCanvas.getContext('2d');
  var prev = prevCanvas.getContext('2d');
  var TAU = Math.PI * 2;
  var FRAME_MS = 1000 / 30;
  var MIN_SIDE = 56; // schmalere Seitenstreifen (Handy): keine Seitenmotive

  // Farben wie im Spiel (src/game/epochs.js): oben, unten, Akzent
  var THEMES = [
    { top: [20, 87, 184], bottom: [5, 22, 56], accent: [127, 224, 255], kinds: ['bubble', 'bubble', 'bubble', 'mote'] },
    { top: [14, 138, 127], bottom: [5, 42, 48], accent: [157, 255, 214], kinds: ['cell', 'cell', 'mote'] },
    { top: [91, 43, 176], bottom: [16, 8, 58], accent: [255, 139, 224], kinds: ['jelly', 'snow', 'snow', 'snow'] },
  ];

  var reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var connection = navigator.connection || null;
  function stillMode() {
    return Boolean((reduceQuery && reduceQuery.matches) || (connection && connection.saveData));
  }

  var dpr = 1;
  var W = 0; // Feld (CSS-Pixel)
  var H = 0;
  var col = { left: 0, right: 0, width: 0, height: 0 };
  var sideW = 0;
  var epoch = 0;
  var palette = { top: THEMES[0].top.slice(), bottom: THEMES[0].bottom.slice(), accent: THEMES[0].accent.slice() };
  var sideParts = [];
  var previewOn = true;
  var visible = false;
  var raf = 0;
  var last = 0;
  var acc = 0;
  var t = 0;

  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }

  function rgba(c, a) {
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a + ')';
  }

  /* ---------- Grösse ---------- */

  function measure() {
    var s = stage.getBoundingClientRect();
    var c = column.getBoundingClientRect();
    W = Math.max(1, Math.round(s.width));
    H = Math.max(1, Math.round(s.height));
    col = { left: c.left - s.left, right: c.right - s.left, width: Math.max(1, Math.round(c.width)), height: Math.max(1, Math.round(c.height)) };
    sideW = Math.max(0, col.left);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    ambCanvas.width = Math.round(W * dpr);
    ambCanvas.height = Math.round(H * dpr);
    prevCanvas.width = Math.round(col.width * dpr);
    prevCanvas.height = Math.round(col.height * dpr);
    fillSides();
    drawAll(0);
  }

  /* ---------- Seiten ---------- */

  function sideCount() {
    if (sideW < MIN_SIDE) return 0;
    return Math.max(6, Math.min(22, Math.round((sideW * H) / 9000)));
  }

  /** init: sofort sichtbar an zufälliger Stelle; scatter: zufällige Stelle, aber sanft einblenden (Zeitalterwechsel) */
  function newSidePart(init, scatter) {
    var anywhere = init || scatter;
    var theme = THEMES[epoch];
    var kind = theme.kinds[Math.floor(Math.random() * theme.kinds.length)];
    var left = Math.random() < 0.5;
    var margin = 14;
    var x = left ? rnd(margin, Math.max(margin + 1, col.left - margin)) : rnd(col.right + margin, Math.max(col.right + margin + 1, W - margin));
    var z = rnd(0.35, 1);
    var p = { kind: kind, x: x, z: z, ph: rnd(0, TAU), life: init ? 1 : 0, dying: false };
    var init0 = anywhere;
    if (kind === 'bubble') {
      p.s = rnd(3, 9) * z;
      p.vy = -rnd(8, 22) * z;
      p.y = init0 ? rnd(0, H) : H + 20;
    } else if (kind === 'cell') {
      p.s = rnd(7, 15) * z;
      p.vy = rnd(-5, 5);
      p.vx = rnd(-3, 3);
      p.y = rnd(20, H - 20);
    } else if (kind === 'jelly') {
      p.s = rnd(14, 26) * z;
      p.vy = -rnd(4, 9) * z;
      p.y = init0 ? rnd(0, H) : H + 60;
    } else if (kind === 'snow') {
      p.s = rnd(0.8, 2.2);
      p.vy = rnd(6, 15) * z;
      p.y = init0 ? rnd(0, H) : -10;
    } else {
      p.s = rnd(0.8, 1.8);
      p.vy = -rnd(2, 6);
      p.vx = rnd(-2, 2);
      p.y = rnd(0, H);
    }
    return p;
  }

  function fillSides() {
    var n = sideCount();
    sideParts = [];
    for (var i = 0; i < n; i++) sideParts.push(newSidePart(true));
  }

  function inSide(p) {
    return p.x < col.left - 6 || p.x > col.right + 6;
  }

  function updateSides(dt) {
    var theme = THEMES[epoch];
    for (var i = 0; i < sideParts.length; i++) {
      var p = sideParts[i];
      if (!p.dying && theme.kinds.indexOf(p.kind) < 0) p.dying = true;
      p.life = p.dying ? p.life - dt / 1.2 : Math.min(1, p.life + dt / 1.5);
      p.y += p.vy * dt;
      p.x += (p.vx || 0) * dt + Math.sin(t * 0.7 + p.ph) * 4 * dt;
      var gone = p.y < -70 || p.y > H + 70 || (p.kind === 'cell' && (p.y < 10 || p.y > H - 10)) || !inSide(p);
      if (p.life <= 0) sideParts[i] = newSidePart(false, true);
      else if (gone && p.kind !== 'cell') sideParts[i] = newSidePart(false);
      else if (gone) p.vy = -p.vy;
    }
  }

  function drawSide(p) {
    var a = p.life * (0.14 + 0.34 * p.z);
    if (a <= 0.005) return;
    var c = palette.accent;
    var s;
    var k;
    if (p.kind === 'bubble') {
      amb.lineWidth = 1.2;
      amb.strokeStyle = rgba(c, a);
      amb.beginPath();
      amb.arc(p.x, p.y, p.s, 0, TAU);
      amb.stroke();
      amb.fillStyle = rgba(c, a * 0.7);
      amb.beginPath();
      amb.arc(p.x - p.s * 0.35, p.y - p.s * 0.35, p.s * 0.22, 0, TAU);
      amb.fill();
    } else if (p.kind === 'cell') {
      s = p.s;
      amb.beginPath();
      for (k = 0; k <= 12; k++) {
        var ang = (k / 12) * TAU;
        var r = s * (1 + 0.12 * Math.sin(ang * 3 + t * 0.9 + p.ph));
        var px = p.x + Math.cos(ang) * r;
        var py = p.y + Math.sin(ang) * r * 0.85;
        if (k === 0) amb.moveTo(px, py);
        else amb.lineTo(px, py);
      }
      amb.closePath();
      amb.fillStyle = rgba(c, a * 0.45);
      amb.fill();
      amb.lineWidth = 1;
      amb.strokeStyle = rgba(c, a * 0.8);
      amb.stroke();
      amb.fillStyle = rgba(palette.bottom, Math.min(0.6, a * 1.6));
      amb.beginPath();
      amb.arc(p.x + s * 0.2, p.y - s * 0.1, s * 0.38, 0, TAU);
      amb.fill();
    } else if (p.kind === 'jelly') {
      var pulse = 1 + 0.09 * Math.sin(t * 1.6 + p.ph);
      s = p.s;
      var bw = s * pulse;
      var bh = s * 0.8 * (2 - pulse);
      var g = amb.createRadialGradient(p.x, p.y - bh * 0.3, 0, p.x, p.y, bw * 1.3);
      g.addColorStop(0, rgba(c, a * 0.9));
      g.addColorStop(1, rgba(c, a * 0.15));
      amb.fillStyle = g;
      amb.beginPath();
      amb.ellipse(p.x, p.y, bw, bh, 0, Math.PI, TAU);
      amb.quadraticCurveTo(p.x, p.y + bh * 0.25, p.x - bw, p.y);
      amb.fill();
      amb.lineWidth = 1;
      amb.strokeStyle = rgba(c, a * 0.55);
      for (k = 0; k < 4; k++) {
        var tx = p.x - bw * 0.6 + (k * bw * 1.2) / 3;
        var len = s * (2 + 0.4 * Math.sin(p.ph + k));
        amb.beginPath();
        amb.moveTo(tx, p.y + 1);
        amb.quadraticCurveTo(tx + Math.sin(t * 2 + p.ph + k) * s * 0.35, p.y + len * 0.5, tx + Math.sin(t * 1.4 + p.ph + k * 2) * s * 0.25, p.y + len);
        amb.stroke();
      }
    } else {
      amb.fillStyle = rgba(c, a * (p.kind === 'snow' ? 1.3 : 0.9));
      amb.beginPath();
      amb.arc(p.x, p.y, p.s, 0, TAU);
      amb.fill();
    }
  }

  function drawAmbience() {
    amb.setTransform(dpr, 0, 0, dpr, 0, 0);
    amb.clearRect(0, 0, W, H);
    if (sideW < 1) return;
    // Farbschimmer des Zeitalters, nach aussen dunkler
    var g = amb.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgba(palette.top, 0.26));
    g.addColorStop(1, rgba(palette.bottom, 0.34));
    amb.fillStyle = g;
    amb.fillRect(0, 0, W, H);
    var fadeL = amb.createLinearGradient(0, 0, col.left, 0);
    fadeL.addColorStop(0, 'rgba(6,7,11,0.7)');
    fadeL.addColorStop(1, 'rgba(6,7,11,0)');
    amb.fillStyle = fadeL;
    amb.fillRect(0, 0, col.left, H);
    var fadeR = amb.createLinearGradient(W, 0, col.right, 0);
    fadeR.addColorStop(0, 'rgba(6,7,11,0.7)');
    fadeR.addColorStop(1, 'rgba(6,7,11,0)');
    amb.fillStyle = fadeR;
    amb.fillRect(col.right, 0, W - col.right, H);
    for (var i = 0; i < sideParts.length; i++) drawSide(sideParts[i]);
  }

  /* ---------- Vorschau (Urozean wie im Spiel; Welt 360 Einheiten breit) ---------- */

  var READY_SCROLL = 55;
  var preview = { offset: 0, dist: 0, parts: [] };
  for (var pi = 0; pi < 38; pi++) {
    preview.parts.push({ x: rnd(0, 360), y: rnd(0, 640), z: rnd(0.35, 1), s: rnd(4, 12), vy: -rnd(10, 35), ph: rnd(0, TAU) });
  }

  function wobble(worldY, phase) {
    return Math.sin(worldY * 0.006 + phase) * 5 + Math.sin(worldY * 0.017 + phase * 2) * 2.5;
  }

  function updatePreview(dt) {
    var LH = (col.height * 360) / col.width;
    preview.offset += READY_SCROLL * dt;
    preview.dist += READY_SCROLL * dt;
    for (var i = 0; i < preview.parts.length; i++) {
      var p = preview.parts[i];
      p.y += (READY_SCROLL * 0.3 * p.z + p.vy) * dt;
      p.x += Math.sin(t * 0.7 + p.ph) * 8 * dt;
      if (p.y < -24) {
        p.y = LH + 20;
        p.x = rnd(0, 360);
      } else if (p.y > LH + 24) p.y = -20;
    }
  }

  function drawPreview() {
    var theme = THEMES[0];
    var scale = col.width / 360;
    var LH = col.height / scale;
    prev.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    var g = prev.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, rgba(theme.top, 1));
    g.addColorStop(1, rgba(theme.bottom, 1));
    prev.fillStyle = g;
    prev.fillRect(0, 0, 360, LH);
    var i;
    for (i = 0; i < 3; i++) {
      var x = 360 * (0.15 + 0.35 * i) + Math.sin(t * 0.2 + i * 2) * 30;
      var y = ((preview.offset * 0.05 + i * 280) % (LH + 320)) - 160;
      var rg = prev.createRadialGradient(x, y, 0, x, y, 180);
      rg.addColorStop(0, rgba(theme.accent, 0.14));
      rg.addColorStop(1, rgba(theme.accent, 0));
      prev.fillStyle = rg;
      prev.fillRect(0, 0, 360, LH);
    }
    for (i = 0; i < preview.parts.length; i++) {
      var p = preview.parts[i];
      var s = p.s * p.z;
      var a = 0.16 + 0.42 * p.z;
      prev.lineWidth = 1.4;
      prev.strokeStyle = rgba(theme.accent, a);
      prev.beginPath();
      prev.arc(p.x, p.y, s, 0, TAU);
      prev.stroke();
      prev.fillStyle = rgba(theme.accent, a * 0.7);
      prev.beginPath();
      prev.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.22, 0, TAU);
      prev.fill();
    }
    // Angedeutete rote Seitenwände (etwas zurückhaltender als im Spiel)
    prev.lineCap = 'round';
    prev.lineJoin = 'round';
    for (var side = 0; side < 2; side++) {
      prev.beginPath();
      for (var yy = -12; yy <= LH + 12; yy += 12) {
        var worldY = preview.dist + (LH - yy);
        var wx = side ? 340 - wobble(worldY, 1.7) : 20 + wobble(worldY, 0);
        if (yy === -12) prev.moveTo(wx, yy);
        else prev.lineTo(wx, yy);
      }
      prev.strokeStyle = 'rgba(255,70,50,0.18)';
      prev.lineWidth = 24;
      prev.stroke();
      prev.strokeStyle = 'rgba(217,48,31,0.85)';
      prev.lineWidth = 13;
      prev.stroke();
      prev.strokeStyle = 'rgba(255,200,180,0.6)';
      prev.lineWidth = 2.5;
      prev.stroke();
    }
  }

  /* ---------- Takt ---------- */

  function blendPalette(dt) {
    var target = THEMES[epoch];
    var k = dt > 0 ? 1 - Math.exp(-dt * 1.4) : 1;
    ['top', 'bottom', 'accent'].forEach(function (key) {
      for (var i = 0; i < 3; i++) palette[key][i] += (target[key][i] - palette[key][i]) * k;
    });
  }

  function drawAll(dt) {
    blendPalette(dt);
    if (dt > 0) {
      updateSides(dt);
      if (previewOn) updatePreview(dt);
    }
    drawAmbience();
    if (previewOn) drawPreview();
  }

  function needsLoop() {
    if (stillMode() || !visible || document.hidden) return false;
    return previewOn || sideParts.length > 0;
  }

  function frame(now) {
    raf = 0;
    if (!needsLoop()) return;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    acc += dt * 1000;
    if (acc >= FRAME_MS) {
      var step = acc / 1000;
      acc = 0;
      t += step;
      drawAll(step);
    }
    raf = window.requestAnimationFrame(frame);
  }

  function schedule() {
    if (needsLoop()) {
      if (!raf) {
        last = 0;
        acc = FRAME_MS;
        raf = window.requestAnimationFrame(frame);
      }
    } else {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      // Standbild (Bewegungsreduktion, Datensparmodus) mit den Zielfarben
      if (stillMode()) {
        blendPalette(0);
        sideParts.forEach(function (p) {
          p.life = 1;
        });
        drawAll(0);
      }
    }
  }

  /* ---------- Ereignisse ---------- */

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      function (entries) {
        visible = entries[0].isIntersecting;
        schedule();
      },
      { threshold: 0.01 }
    ).observe(stage);
  } else {
    visible = true;
  }
  document.addEventListener('visibilitychange', schedule);
  if (reduceQuery && reduceQuery.addEventListener) reduceQuery.addEventListener('change', schedule);

  var resizeTimer = 0;
  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      measure();
      schedule();
    }, 120);
  }
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(stage);
  else window.addEventListener('resize', onResize);

  window.HoldOnDemoVisuals = {
    setEpoch: function (index) {
      var next = Math.max(0, Math.min(THEMES.length - 1, Number(index) || 0));
      if (next === epoch) return;
      epoch = next;
      if (stillMode()) fillSides(); // Standbild: Motive sofort im neuen Zeitalter
      schedule();
    },
    getEpoch: function () {
      return epoch;
    },
    setPreview: function (on) {
      previewOn = Boolean(on);
      if (previewOn) drawPreview();
      schedule();
    },
    isRunning: function () {
      return raf !== 0;
    },
  };

  measure();
  schedule();
})();
