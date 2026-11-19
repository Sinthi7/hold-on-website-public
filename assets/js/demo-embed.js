/* HOLD ON: Through Time — Browser-Demo im Feld "Im Browser ausprobieren" (nur Startseite).
   Vor dem Klick läuft KEIN Spielcode: Das Feld zeigt nur die gezeichnete Vorschau (demo-ambience.js).
   Nähert sich der Abschnitt, werden die Demo-Dateien höchstens vorab heruntergeladen (rel=prefetch, nie
   ausgeführt; nicht im Datensparmodus). Erst "Demo spielen" legt das iframe mit demo/ an. Ist die Demo
   bereit, blenden Vorschau und dunkle Schicht weich aus. Das Feld behält dabei seine Grösse.
   Die Demo bleibt beim Wegscrollen erhalten; nur "Demo schliessen" entfernt sie (Spiel und Ton stoppen).
   Seitenmotive folgen dem Zeitalter, das die Demo anzeigt (#epochName, gleiche Herkunft, nur lesen).
   Ohne JavaScript bleibt "Demo spielen" ein normaler Link auf die Demo-Seite. Kein Tracking. */
(function () {
  'use strict';

  var stage = document.getElementById('demo-stage');
  var column = document.getElementById('demo-column');
  var start = document.getElementById('demo-start');
  var tools = document.getElementById('demo-tools');
  var closeButton = document.getElementById('demo-close');
  if (!stage || !column || !start) return;

  var DEMO_URL = start.getAttribute('href');
  var READY_TIMEOUT_MS = 8000; // spätestens dann wird die Demo gezeigt, auch ohne Bereit-Signal
  var FADE_MS = 700;

  // Zeitalter-Namen, wie die Demo sie anzeigt (Englisch und Deutsch, gleiche Reihenfolge wie im Spiel)
  var EPOCH_NAMES = [
    ['Primordial Ocean', 'Urozean'],
    ['First Cells', 'Erste Zellen'],
    ['Life in the Sea', 'Leben im Meer'],
    ['The Land Turns Green', 'Das Land wird grün'],
  ];

  var frame = null;
  var observer = null;
  var readyTimer = 0;
  var token = 0;
  var connection = navigator.connection || null;
  var saveData = Boolean(connection && connection.saveData);
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function visuals() {
    return window.HoldOnDemoVisuals || null;
  }

  /* ---------- Vorab herunterladen (ohne Ausführen) ---------- */

  var prefetched = false;
  function addPrefetch(href) {
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }

  function prefetchDemo() {
    if (prefetched || saveData || !window.fetch) return;
    prefetched = true;
    // Nur Text lesen: die Seite der Demo wird nicht ausgeführt
    fetch(DEMO_URL, { credentials: 'same-origin' })
      .then(function (res) {
        return res.ok ? res.text() : '';
      })
      .then(function (html) {
        var re = /(?:src|href)="(\.\/assets\/[^"]+\.(?:js|css))"/g;
        var m;
        while ((m = re.exec(html))) addPrefetch(new URL(m[1], new URL(DEMO_URL, document.baseURI)).href);
      })
      .catch(function () {
        /* Vorab-Download ist nur eine Beschleunigung */
      });
  }

  if ('IntersectionObserver' in window) {
    var near = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          prefetchDemo();
          near.disconnect();
        }
      },
      { rootMargin: '400px 0px' }
    );
    near.observe(stage);
  }

  /* ---------- Zeitalter aus der Demo mitlesen ---------- */

  function epochFromText(text) {
    var name = String(text || '').trim();
    for (var i = 0; i < EPOCH_NAMES.length; i++) {
      if (EPOCH_NAMES[i].indexOf(name) >= 0) return i;
    }
    return -1;
  }

  function syncEpoch(doc) {
    var label = doc.getElementById('epochName');
    var index = label ? epochFromText(label.textContent) : -1;
    if (index < 0) {
      // Rückfall: Banner "Epoch 2" / "Zeitalter 2"
      var banner = doc.getElementById('banner');
      var m = banner && /(\d+)/.exec(banner.textContent || '');
      index = m ? Number(m[1]) - 1 : 0;
    }
    if (visuals()) visuals().setEpoch(index);
  }

  function watchEpoch() {
    var doc;
    try {
      doc = frame.contentDocument;
    } catch (e) {
      return; // andere Herkunft: Seitenmotive bleiben beim Urozean
    }
    if (!doc) return;
    var targets = [doc.getElementById('epochName'), doc.getElementById('banner')].filter(Boolean);
    if (!targets.length || !window.MutationObserver) return;
    observer = new MutationObserver(function () {
      syncEpoch(doc);
    });
    targets.forEach(function (el) {
      observer.observe(el, { childList: true, characterData: true, subtree: true });
    });
    syncEpoch(doc);
  }

  /* ---------- Start ---------- */

  function gameBooted() {
    try {
      var doc = frame.contentDocument;
      var panel = doc && doc.getElementById('panel');
      return Boolean(panel && panel.innerHTML.trim());
    } catch (e) {
      return true; // nicht lesbar: nach dem Laden einfach zeigen
    }
  }

  function reveal(my) {
    if (my !== token || !frame || stage.classList.contains('is-ready')) return;
    window.clearTimeout(readyTimer);
    stage.classList.remove('is-loading');
    stage.classList.add('is-ready');
    if (tools) tools.hidden = false;
    watchEpoch();
    try {
      frame.contentWindow.focus();
    } catch (e) {
      /* Fokus ist nur eine Bequemlichkeit */
    }
    // Vorschau anhalten, sobald sie ausgeblendet ist
    window.setTimeout(function () {
      if (my === token && visuals()) visuals().setPreview(false);
    }, reduceMotion ? 0 : FADE_MS);
  }

  function waitUntilBooted(my, tries) {
    if (my !== token || !frame) return;
    if (gameBooted() || tries > 40) {
      // zwei Bilder abwarten, damit das Spiel sein erstes Bild gezeichnet hat
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          reveal(my);
        });
      });
      return;
    }
    window.setTimeout(function () {
      waitUntilBooted(my, tries + 1);
    }, 50);
  }

  function openDemo() {
    if (frame) return;
    token += 1;
    var my = token;
    stage.classList.add('is-loading');
    start.setAttribute('aria-busy', 'true');
    frame = document.createElement('iframe');
    frame.className = 'demo-game';
    frame.src = DEMO_URL;
    frame.title = 'HOLD ON: Through Time – Demo';
    frame.setAttribute('allow', 'autoplay; fullscreen');
    frame.addEventListener('load', function () {
      waitUntilBooted(my, 0);
    });
    column.appendChild(frame);
    readyTimer = window.setTimeout(function () {
      reveal(my);
    }, READY_TIMEOUT_MS);
    window.requestAnimationFrame(showStage);
  }

  // Das ganze Feld in den sichtbaren Bereich holen, unter der festen Kopfzeile
  function showStage() {
    var bar = document.querySelector('.topbar');
    var barHeight = bar ? bar.getBoundingClientRect().height : 0;
    var rect = stage.getBoundingClientRect();
    var free = window.innerHeight - barHeight;
    var offset = barHeight + Math.max(0, (free - rect.height) / 2);
    window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - offset), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function closeDemo() {
    if (!frame) return;
    token += 1;
    window.clearTimeout(readyTimer);
    if (observer) observer.disconnect();
    observer = null;
    frame.remove();
    frame = null;
    if (visuals()) {
      visuals().setPreview(true);
      visuals().setEpoch(0);
    }
    stage.classList.remove('is-ready', 'is-loading');
    start.removeAttribute('aria-busy');
    if (tools) tools.hidden = true;
    start.focus({ preventScroll: true });
  }

  start.addEventListener('click', function (e) {
    // Neuer Tab, Mittelklick usw.: wie ein normaler Link
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openDemo();
  });
  if (closeButton) closeButton.addEventListener('click', closeDemo);
})();
