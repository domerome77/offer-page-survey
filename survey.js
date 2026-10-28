// Shared by every survey page: the prototype list, the respondent's progress and where answers are stored.
window.SV = (function () {
  // The variants inside prototypes.html (its VARIANTS list). `n` is the ?v= key, `name` is shown to the admin only.
  const PROTOS = [
    { n: '1', name: 'Cards, tags' },
    { n: '2', name: 'Pick-up and drop-off' },
    { n: '3', name: 'Flexibility tiles' },
    { n: '4', name: 'Panels with radios' },
    { n: '5', name: 'Private first' },
    { n: '6', name: '1+2' },
    { n: '7', name: 'Tabs on the card' },
    { n: '8', name: 'List, headings inside' },
    { n: '9', name: 'Slider' },
    { n: '9a', name: 'Slider, prices' },
    { n: '10', name: 'Two products' },
  ];

  // The three questions, each answered on the same 1–5 face scale.
  const QUESTIONS = [
    { key: 'clear', label: 'How easy was it to understand the options?', low: 'Very confusing', high: 'Very clear' },
    { key: 'easy', label: 'How easy was it to pick the ride you wanted?', low: 'Very hard', high: 'Very easy' },
    { key: 'like', label: 'How much do you like it?', low: 'Not at all', high: 'Love it' },
  ];
  const FACES = ['😣', '🙁', '😐', '🙂', '😍'];

  // ---------- storage ----------
  // BACKEND 'sheet' sends answers to the Google Sheet's Apps Script web app (apps-script/Code.gs).
  // Without SHEET_URL it falls back to 'local': answers stay in this browser only (for trying it out).
  const CONFIG = { SHEET_URL: '' };
  CONFIG.BACKEND = CONFIG.SHEET_URL ? 'sheet' : 'local';

  const LOCAL_KEY = 'ops.responses';
  const local = {
    async save(doc) {
      const all = await local.list();
      const i = all.findIndex(d => d.id === doc.id);
      if (i >= 0) all[i] = doc; else all.push(doc);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
    },
    async list() {
      try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch (e) { return []; }
    },
    async reset() { localStorage.removeItem(LOCAL_KEY); },
  };
  // text/plain keeps it a "simple" request, so the browser sends it to Apps Script without a CORS preflight
  async function post(body) {
    const r = await fetch(CONFIG.SHEET_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'save failed');
    return j;
  }
  const sheet = {
    save: doc => post({ action: 'save', doc }),
    async list() {
      const r = await fetch(CONFIG.SHEET_URL + '?action=list&t=' + Date.now());
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'load failed');
      return j.docs.map(d => Object.assign(d, { clear: num(d.clear), easy: num(d.easy), like: num(d.like) }));
    },
    reset: key => post({ action: 'reset', key }),
  };
  const num = x => (x === null || x === '' ? null : Number(x));
  const store = { local, sheet }[CONFIG.BACKEND];

  // ---------- this respondent ----------
  const ME_KEY = 'ops.me';
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  // Prototypes pinned to a spot for everyone ({ prototype: position, 1-based }); the rest are shuffled around them.
  const PINNED = { '10': 3 };
  // Each respondent sees the other prototypes in their own random order, so none is always seen first or last.
  function makeOrder() {
    const order = shuffle(PROTOS.map(p => p.n).filter(n => !PINNED[n]));
    Object.keys(PINNED).sort((a, b) => PINNED[a] - PINNED[b]).forEach(n => order.splice(PINNED[n] - 1, 0, n));
    return order;
  }
  const orderOk = o => Array.isArray(o) && o.length === PROTOS.length && Object.keys(PINNED).every(n => o[PINNED[n] - 1] === n);
  function me() {
    let m = null;
    try { m = JSON.parse(localStorage.getItem(ME_KEY)); } catch (e) {}
    if (!m || !orderOk(m.order)) {
      m = { rid: uid(), order: makeOrder(), done: {}, fav: null, name: '' };
      saveMe(m);
    }
    return m;
  }
  function saveMe(m) { try { localStorage.setItem(ME_KEY, JSON.stringify(m)); } catch (e) {} }
  function restart() { try { localStorage.removeItem(ME_KEY); } catch (e) {} }

  // One document per respondent and prototype (re-rating overwrites), one per respondent for the favourite.
  async function saveRating(n, answers, comment) {
    const m = me();
    m.done[n] = Object.assign({ comment }, answers);
    saveMe(m);
    await store.save({ id: m.rid + ':' + n, type: 'rating', rid: m.rid, name: m.name, v: n, ...answers, comment, ts: new Date().toISOString() });
  }
  async function saveFavourite(n, comment) {
    const m = me();
    m.fav = n;
    saveMe(m);
    await store.save({ id: m.rid + ':fav', type: 'fav', rid: m.rid, name: m.name, v: n, comment, ts: new Date().toISOString() });
  }

  const proto = n => PROTOS.find(p => p.n === n);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  return { PROTOS, QUESTIONS, FACES, CONFIG, store, me, saveMe, restart, saveRating, saveFavourite, proto, esc };
})();
