(() => {
  const root = document.documentElement;
  const cursor = document.getElementById('cursor-cross');
  const archiveToggle = document.getElementById('archive-toggle');
  let lastY = scrollY;
  let scrollTimer;
  let audio;
  let lastGhost = 0;
  let lastScrollSound = 0;
  let lastTypeSound = 0;
  let lastSelectSound = 0;
  let lastDragSound = 0;

  // — Live clock —
  const clockEl = document.getElementById('site-clock');
  const wxEl = document.getElementById('wx-readout');
  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    if (!clockEl) return;
    const d = new Date();
    clockEl.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  tick();
  setInterval(tick, 1000);

  // — Ambient: time-of-day bucket + weather layer —
  function timeBucket() {
    const h = new Date().getHours();
    return h < 5 ? 'ambient-late' : h < 8 ? 'ambient-dawn' : h > 20 ? 'ambient-night' : 'ambient-day';
  }
  function applyTime() {
    root.classList.remove('ambient-late', 'ambient-dawn', 'ambient-day', 'ambient-night');
    root.classList.add(timeBucket());
  }
  applyTime();
  setInterval(applyTime, 60000);

  // WMO weather_code → small sky set
  function codeToSky(c) {
    if (c === 0) return 'clear';
    if (c <= 3) return 'cloud';
    if (c === 45 || c === 48) return 'fog';
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
    if (c >= 95) return 'storm';
    return 'cloud';
  }
  const SKY_TEMP = { clear: 'soft', cloud: 'dry', fog: 'dry', rain: 'cold', snow: 'cold', storm: 'late' };
  function applyWeather(wx) {
    if (!wx || !wx.sky) return;
    root.dataset.sky = wx.sky;
    root.dataset.isDay = String(wx.isDay);
    if (wxEl) {
      wxEl.textContent = wx.sky + ' · ' + Math.round(wx.tempF) + '°';
      wxEl.dataset.temp = SKY_TEMP[wx.sky] || 'dry';
    }
  }

  const WX_KEY = 'wx';
  const WX_TTL = 30 * 60 * 1000;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(WX_KEY) || 'null'); } catch {}
  if (cached && cached.sky) applyWeather(cached); // flicker-free repeat visit

  async function fetchWeather(lat, lon) {
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
        '&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit';
      const r = await fetch(url);
      if (!r.ok) return;
      const j = await r.json();
      const cur = j.current || {};
      const wx = { sky: codeToSky(cur.weather_code), tempF: cur.temperature_2m, isDay: cur.is_day === 1, ts: Date.now(), lat, lon };
      localStorage.setItem(WX_KEY, JSON.stringify(wx));
      applyWeather(wx);
    } catch {}
  }

  // Refresh only if no fresh cache. Geolocation prompts once; denial → time-only ambient.
  const fresh = cached && cached.ts && (Date.now() - cached.ts) < WX_TTL;
  if (!fresh && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude.toFixed(3), pos.coords.longitude.toFixed(3)),
      () => {}, // denied/error → leave time-only ambient, no re-prompt
      { timeout: 8000, maximumAge: 30 * 60 * 1000 }
    );
  }

  // — Reading progress bar (post pages only) —
  const readBar = document.getElementById('read-bar');
  const article = document.querySelector('.post');
  function updateReadBar() {
    if (!readBar || !article) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    const pct = max > 0 ? Math.min(1, scrollY / max) : 0;
    readBar.style.width = (pct * 100).toFixed(1) + '%';
  }
  if (article) updateReadBar();

  const applyArchive = (on) => {
    document.body.classList.toggle('archive-mode', on);
    localStorage.setItem('archive-mode', on ? '1' : '0');
  };
  applyArchive(localStorage.getItem('archive-mode') === '1');
  archiveToggle?.addEventListener('click', (e) => { e.preventDefault(); applyArchive(!document.body.classList.contains('archive-mode')); play('archive'); });
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'a') return;
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName || '')) return;
    applyArchive(!document.body.classList.contains('archive-mode'));
    play('archive');
  });

  const move = (e) => {
    if (cursor) { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }
    const now = performance.now();
    if (now - lastGhost > 42) { lastGhost = now; ghost(e.clientX, e.clientY); }
  };

  function ensureAudio() { audio ||= new (window.AudioContext || window.webkitAudioContext)(); return audio; }
  function play(kind = 'default') {
    try {
      const ctx = ensureAudio();
      const palette = {
        default: [760, 0.038, 0.045],
        link: [980, 0.032, 0.035],
        button: [520, 0.045, 0.055],
        save: [660, 0.06, 0.05],
        archive: [310, 0.07, 0.04],
        delete: [180, 0.075, 0.05],
        scroll: [240, 0.018, 0.032],
        type: [1180, 0.018, 0.018],
        select: [430, 0.05, 0.026],
        drag: [150, 0.024, 0.018],
      };
      const [freq, dur, gainMax] = palette[kind] || palette.default;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = kind === 'delete' || kind === 'drag' ? 'sawtooth' : kind === 'scroll' ? 'triangle' : 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(gainMax, ctx.currentTime + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur + 0.01);
    } catch {}
  }

  function soundKind(target) {
    if (target.closest('.btn-danger')) return 'delete';
    if (target.closest('#save,#save-settings')) return 'save';
    if (target.closest('button,.btn-primary,.btn-ghost')) return 'button';
    if (target.closest('a')) return 'link';
    return 'default';
  }

  function ghost(x, y) {
    if (matchMedia('(pointer: coarse)').matches) return;
    const el = document.createElement('span');
    el.className = 'cursor-ghost';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerdown', (e) => { cursor?.classList.add('is-down'); play(soundKind(e.target)); });
  addEventListener('pointerup', () => cursor?.classList.remove('is-down'));
  addEventListener('keydown', (e) => {
    if (!['INPUT','TEXTAREA'].includes(e.target?.tagName || '') && !e.target?.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const now = performance.now();
    if (now - lastTypeSound > 34) { lastTypeSound = now; play('type'); }
  }, { passive: true });
  addEventListener('selectionchange', () => {
    const selected = String(getSelection?.() || '').trim();
    if (!selected) return;
    const now = performance.now();
    if (now - lastSelectSound > 260) { lastSelectSound = now; play('select'); }
  });
  addEventListener('dragover', () => {
    const now = performance.now();
    if (now - lastDragSound > 180) { lastDragSound = now; play('drag'); }
  }, { passive: true });
  addEventListener('scroll', () => {
    const y = scrollY;
    cursor?.classList.toggle('scroll-down', y > lastY);
    cursor?.classList.toggle('scroll-up', y < lastY);
    lastY = y;
    updateReadBar();
    const now = performance.now();
    if (now - lastScrollSound > 95) { lastScrollSound = now; play('scroll'); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      cursor?.classList.remove('scroll-down', 'scroll-up');
    }, 140);
  }, { passive: true });
})();