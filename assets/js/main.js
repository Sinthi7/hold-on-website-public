/* HOLD ON: Through Time — kleine Helfer für die Website.
   Kein Tracking, keine Cookies, keine externen Dienste. Ohne JavaScript ist alles sichtbar und bedienbar.
   Einzige lokale Speicherung: die selbst gewählte Sprache (localStorage "holdon.lang"), nur in diesem Browser. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  /* ---------- Sprache: Englisch (im HTML) oder Deutsch (assets/js/i18n.js) ----------
     Reihenfolge: auf der Datenschutzseite ein Link mit #en/#de, sonst die selbst gewählte Sprache,
     sonst die Browsersprache (de, de-CH, de-AT … = Deutsch), sonst Englisch. */
  var STORE_KEY = 'holdon.lang';
  var DE = window.HOLDON_DE || {};

  function savedLang() {
    try {
      var v = window.localStorage.getItem(STORE_KEY);
      return v === 'de' || v === 'en' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function saveLang(lang) {
    try {
      window.localStorage.setItem(STORE_KEY, lang);
    } catch (e) {
      /* Speicher gesperrt (z. B. privates Surfen): gilt dann nur für diesen Besuch */
    }
  }

  function browserLang() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    var first = String(list[0] || '').toLowerCase();
    return first === 'de' || first.indexOf('de-') === 0 || first.indexOf('de_') === 0 ? 'de' : 'en';
  }

  function hashLang() {
    if (root.getAttribute('data-page') !== 'privacy') return null;
    return location.hash === '#de' ? 'de' : location.hash === '#en' ? 'en' : null;
  }

  // Englische Originale aus dem HTML merken, damit ein Wechsel zurück genau sie wiederherstellt
  function collect(selector, attr, read) {
    return Array.prototype.map.call(document.querySelectorAll(selector), function (el) {
      return { el: el, key: el.getAttribute(attr), en: read(el) };
    });
  }
  var texts = collect('[data-i18n]', 'data-i18n', function (el) {
    return el.textContent;
  });
  var htmls = collect('[data-i18n-html]', 'data-i18n-html', function (el) {
    return el.innerHTML;
  });
  var labels = collect('[data-i18n-label]', 'data-i18n-label', function (el) {
    return el.getAttribute('aria-label');
  });
  var page = root.getAttribute('data-page') || 'home';
  var meta = document.querySelector('meta[name="description"]');
  var enTitle = document.title;
  var enDescription = meta ? meta.getAttribute('content') : '';

  function pick(lang, key, en) {
    return lang === 'de' && typeof DE[key] === 'string' ? DE[key] : en;
  }

  function applyLang(lang) {
    root.lang = lang;
    texts.forEach(function (t) {
      t.el.textContent = pick(lang, t.key, t.en);
    });
    htmls.forEach(function (t) {
      t.el.innerHTML = pick(lang, t.key, t.en);
    });
    labels.forEach(function (t) {
      t.el.setAttribute('aria-label', pick(lang, t.key, t.en));
    });
    document.title = pick(lang, page + '.title', enTitle);
    if (meta) meta.setAttribute('content', pick(lang, page + '.description', enDescription));
    document.querySelectorAll('[data-set-lang]').forEach(function (el) {
      var on = el.getAttribute('data-set-lang') === lang;
      if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', on ? 'true' : 'false');
      else if (on) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
    // Datenschutzseite: nur die gewählte Sprachfassung zeigen (ohne JavaScript bleiben beide sichtbar)
    document.querySelectorAll('.lang-block[lang]').forEach(function (block) {
      block.hidden = block.getAttribute('lang') !== lang;
    });
  }

  applyLang(hashLang() || savedLang() || browserLang());

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-set-lang]');
    if (!el) return;
    var lang = el.getAttribute('data-set-lang');
    saveLang(lang);
    applyLang(lang);
    // Steht #en/#de in der Adresse, passt sie zur Wahl (sonst gälte beim Neuladen wieder der alte Anker)
    if (el.tagName === 'BUTTON' && hashLang() && hashLang() !== lang && window.history.replaceState) {
      window.history.replaceState(null, '', '#' + lang);
    }
  });
  window.addEventListener('hashchange', function () {
    var lang = hashLang();
    if (lang) applyLang(lang);
  });

  // Jahr im Copyright
  var year = new Date().getFullYear();
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(year);
  });

  // Kopfzeile bekommt beim Scrollen einen Hintergrund
  var bar = document.querySelector('.topbar');
  function onScroll() {
    if (bar) bar.classList.toggle('scrolled', window.scrollY > 24);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Menü auf dem Handy
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    nav.classList.toggle('open', open);
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  // Sanftes Einblenden beim Scrollen
  var items = document.querySelectorAll('.reveal');
  document.querySelectorAll('.timeline .reveal').forEach(function (el, i) {
    el.style.setProperty('--i', String(i % 4));
  });
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) {
      el.classList.add('visible');
    });
    return;
  }
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  items.forEach(function (el) {
    observer.observe(el);
  });
})();
