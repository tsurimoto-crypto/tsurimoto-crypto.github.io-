/* =========================================================
   Window of Tomorrow — interactions
   ========================================================= */
(function () {

  /* ---- カウントダウン(2026.10.31 24:00 = 11/1 0:00 JST まで) ---- */
  (function countdown() {
    const el = document.getElementById('countdown');
    if (!el) return;
    const target = new Date('2026-11-01T00:00:00+09:00').getTime();
    function tick() {
      const diff = target - Date.now();
      const days = Math.max(0, Math.ceil(diff / 86400000));
      el.textContent = days;
    }
    tick();
    setInterval(tick, 60 * 1000);
  })();

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const defs = document.querySelector('.defs');
  // 見出し要素 → そのゆらぎフィルターの <animate> 群
  const wobbleMap = new Map();

  /* 見出しごとに専用のゆらぎフィルターを生成。
     出現をトリガーに displacement の scale を数秒で 0 へ収束させ、
     ゆらぎ → やがて静止、を実現する。 */
  function makeWobble(id, seed) {
    const f = document.createElementNS(NS, 'filter');
    f.id = id;
    // フィルター領域が文字の外まで及ぶように余白を確保
    f.setAttribute('x', '-20%'); f.setAttribute('y', '-20%');
    f.setAttribute('width', '140%'); f.setAttribute('height', '140%');

    const turb = document.createElementNS(NS, 'feTurbulence');
    turb.setAttribute('type', 'fractalNoise');
    turb.setAttribute('baseFrequency', '0.008 0.014');
    turb.setAttribute('numOctaves', '2');
    turb.setAttribute('seed', String(seed));
    turb.setAttribute('result', 'noise');
    // 出現中はゆらぎが「動いて」見えるよう周波数をアニメート(begin は手動)
    const aBF = document.createElementNS(NS, 'animate');
    aBF.setAttribute('attributeName', 'baseFrequency');
    aBF.setAttribute('dur', '4s');
    aBF.setAttribute('values', '0.006 0.012;0.013 0.008;0.009 0.015;0.010 0.010');
    aBF.setAttribute('begin', 'indefinite');
    aBF.setAttribute('fill', 'freeze');
    turb.appendChild(aBF);

    const disp = document.createElementNS(NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'noise');
    disp.setAttribute('scale', '0'); // 出現前は歪みなし
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    // 強めのゆらぎ → しばらく保って → 0 に収束(freeze で静止)
    const aSc = document.createElementNS(NS, 'animate');
    aSc.setAttribute('attributeName', 'scale');
    aSc.setAttribute('dur', '4s');
    aSc.setAttribute('values', '16;15;0');
    aSc.setAttribute('keyTimes', '0;0.4;1');
    aSc.setAttribute('calcMode', 'spline');
    aSc.setAttribute('keySplines', '0.4 0 0.6 1;0.3 0 0 1');
    aSc.setAttribute('begin', 'indefinite');
    aSc.setAttribute('fill', 'freeze');
    disp.appendChild(aSc);

    f.appendChild(turb);
    f.appendChild(disp);
    defs.appendChild(f);
    return [aBF, aSc];
  }

  /* ---- カテゴリー見出しを1文字ずつ span 化(ゆらぎ出現用) ---- */
  document.querySelectorAll('.cat').forEach((h, k) => {
    const text = h.textContent;
    h.textContent = '';
    const frag = document.createDocumentFragment();
    [...text].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      // sine波でディレイをゆらす → 波打つように文字が立ち上がる
      const wave = Math.sin(i * 0.6) * 0.12;
      s.style.setProperty('--d', (i * 0.06 + wave + 0.15).toFixed(2) + 's');
      frag.appendChild(s);
    });
    h.appendChild(frag);

    // ゆらぎフィルターを用意(reduced-motion 時は静止のまま)。
    // 常時適用すると重いので、出現の瞬間だけ適用し収束後に外す。
    if (!reduce) {
      const id = 'wobble-cat-' + k;
      const anims = makeWobble(id, 11 + k * 3);
      wobbleMap.set(h, { id, anims });
    }
  });

  /* ---- スクロール連動リビール ---- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          // 見出しなら: 出現の瞬間だけゆらぎフィルターを適用して始動し、
          // 収束(約4秒)後にフィルターを外して描画負荷を残さない。
          const w = wobbleMap.get(e.target);
          if (w) {
            const h = e.target;
            h.style.filter = 'url(#' + w.id + ')';
            w.anims.forEach((a) => { try { a.beginElement(); } catch (_) {} });
            setTimeout(() => { h.style.filter = 'none'; }, 4300);
          }
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.25, rootMargin: '0px 0px -8% 0px' }
  );

  document.querySelectorAll('[data-reveal], .reveal').forEach((el) => io.observe(el));

  /* ---- HERO は読み込み時に発火 ---- */
  const hero = document.querySelector('.panel--hero');
  if (hero) requestAnimationFrame(() => hero.classList.add('is-in'));

  /* ---- ナビの現在地ハイライト ---- */
  const links = [...document.querySelectorAll('.nav__menu a')];
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const navIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const a = map.get(e.target.id);
        if (a && e.isIntersecting) {
          links.forEach((l) => (l.style.color = ''));
          a.style.color = 'var(--ink)';
        }
      });
    },
    { threshold: 0.5 }
  );
  document.querySelectorAll('.panel[id]').forEach((p) => navIO.observe(p));

})();
