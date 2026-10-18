// Strange Signals landing page: clips play while on screen, sections fade in, the numbers count up.
// The page works without this script except the motion.
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const conn = navigator.connection;
  // Only real data saver or a very slow link skips autoplay (a "3g" label is common on fine connections).
  const saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));

  const play = (v) => {
    if (saveData || reduced) {
      v.controls = true;
      return;
    }
    if (v.preload === 'none') v.preload = 'auto';
    v.play().catch(() => (v.controls = true));
  };

  // hero loop: stop it on reduced motion or data saver, show controls instead
  const hero = document.getElementById('hero-video');
  if (hero && (saveData || reduced)) {
    hero.removeAttribute('autoplay');
    hero.pause();
    hero.controls = true;
  }

  // clips that play while they are on screen
  const inview = [...document.querySelectorAll('video[data-inview]')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) play(e.target);
          else e.target.pause();
        }
      },
      { threshold: 0.4 },
    );
    inview.forEach((v) => io.observe(v));
    if (hero && !saveData && !reduced) io.observe(hero);
  } else {
    inview.forEach((v) => (v.controls = true));
  }

  // sections fade in as they arrive
  const sections = [...document.querySelectorAll('.feature, .gallery, .making, .credits-sec')];
  if ('IntersectionObserver' in window && !reduced) {
    const reveal = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            reveal.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08 },
    );
    sections.forEach((s) => reveal.observe(s));
  } else {
    sections.forEach((s) => s.classList.add('in'));
  }

  // the numbers count up once when the strip is on screen
  const nums = [...document.querySelectorAll('[data-count]')];
  const fmt = new Intl.NumberFormat('en-US');
  const strip = document.querySelector('.numbers');
  if (strip && nums.length && 'IntersectionObserver' in window && !reduced) {
    const count = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      count.disconnect();
      const t0 = performance.now();
      const dur = 1400;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        nums.forEach((n) => {
          n.textContent = fmt.format(Math.round(Number(n.dataset.count) * ease));
        });
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    count.observe(strip);
  }
})();
