/*
 * BlackLight motion system
 * Intensity and timing live here so the experience can be tuned in one place.
 * GSAP, ScrollTrigger and Lenis are progressive enhancements; native scrolling,
 * content visibility and navigation remain functional when their CDNs are offline.
 */
(() => {
  const SETTINGS = Object.freeze({
    revealDuration: 0.72,
    revealDistance: 16,
    stagger: 0.065,
    heroDuration: 0.68,
    networkRadius: 142,
    magneticStrength: 0.12,
    counterDuration: 1.05,
    easing: 'power3.out',
  });

  const root = document.documentElement;
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine) and (hover: hover)');
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const canUseGsap = Boolean(gsap && ScrollTrigger);
  if (canUseGsap) gsap.registerPlugin(ScrollTrigger);

  let reducedByUser = false;
  let lenis = null;
  let scrollFrame = 0;
  let sectionObserver = null;

  const isReduced = () => reduceQuery.matches || reducedByUser;
  // Lenis uses native page scrolling and delegates anchors with header clearance.
  function setupSmoothScroll() {
    if (!window.Lenis || isReduced()) return;
    try {
      lenis = new window.Lenis({
        anchors: { offset: -84 },
        autoRaf: !canUseGsap,
        duration: 0.95,
        smoothWheel: true,
        syncTouch: false,
        stopInertiaOnNavigate: true,
        respectReducedMotion: true,
      });
      if (canUseGsap) {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
      }
    } catch {
      lenis = null;
    }
  }

  function revealSections() {
    const items = [...document.querySelectorAll('.reveal')];
    const dividers = [...document.querySelectorAll('.section-shell')];
    const allTargets = [...items, ...dividers];
    if (isReduced()) {
      items.forEach((item) => item.classList.add('is-visible'));
      dividers.forEach((section) => section.classList.add('is-visible'));
      return;
    }

    root.classList.add('motion-enabled');
    if (canUseGsap) {
      items.forEach((item) => {
        const siblings = [...item.parentElement.children].filter((child) => child.classList.contains('reveal'));
        const order = Math.max(siblings.indexOf(item), 0);
        gsap.fromTo(item,
          { y: SETTINGS.revealDistance, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: SETTINGS.revealDuration,
            delay: Math.min(order * SETTINGS.stagger, 0.22),
            ease: SETTINGS.easing,
            clearProps: 'transform,opacity,visibility',
            scrollTrigger: { trigger: item, start: 'top 89%', once: true },
            onComplete: () => item.classList.add('is-visible'),
          });
      });
      dividers.forEach((section) => ScrollTrigger.create({
        trigger: section,
        start: 'top 88%',
        once: true,
        onEnter: () => section.classList.add('is-visible'),
      }));
      return;
    }

    if ('IntersectionObserver' in window) {
      sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
      allTargets.forEach((target) => sectionObserver.observe(target));
    } else {
      allTargets.forEach((target) => target.classList.add('is-visible'));
    }
  }

  // Preserve the original h1 text and emphasis while splitting words for the entrance.
  function splitHeroWords() {
    const heading = document.querySelector('.hero-title');
    if (!heading || heading.dataset.split === 'true') return [];
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const words = [];
    nodes.forEach((node) => {
      const parts = node.nodeValue.split(/(\s+)/);
      const fragment = document.createDocumentFragment();
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          fragment.append(document.createTextNode(part));
          return;
        }
        const mask = document.createElement('span');
        mask.className = 'hero-word-mask';
        const word = document.createElement('span');
        word.className = 'hero-word';
        word.textContent = part;
        mask.append(word);
        fragment.append(mask);
        words.push(word);
      });
      node.replaceWith(fragment);
    });
    heading.dataset.split = 'true';
    return words;
  }

  function animateHero() {
    const words = splitHeroWords();
    if (isReduced() || !canUseGsap) return;
    const location = document.querySelector('.hero-location');
    const intro = document.querySelector('.hero-intro');
    const actions = document.querySelector('.hero-actions');
    const note = document.querySelector('.hero-note');
    const image = document.querySelector('.hero-image');
    const sequence = [location, intro, actions, note].filter(Boolean);
    sequence.forEach((element) => gsap.set(element, { y: 12, autoAlpha: 0 }));
    if (image) gsap.set(image, { y: 14, autoAlpha: 0 });

    const timeline = gsap.timeline({ defaults: { ease: SETTINGS.easing } });
    if (location) timeline.to(location, { y: 0, autoAlpha: 1, duration: 0.42 });
    if (words.length) timeline.fromTo(words,
      { yPercent: 108, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, duration: SETTINGS.heroDuration, stagger: 0.055, clearProps: 'transform,opacity,visibility' },
      '-=0.12');
    if (intro) timeline.to(intro, { y: 0, autoAlpha: 1, duration: 0.48 }, '-=0.22');
    if (actions) timeline.to(actions, { y: 0, autoAlpha: 1, duration: 0.42 }, '-=0.18');
    if (note) timeline.to(note, { y: 0, autoAlpha: 1, duration: 0.36 }, '-=0.14');
    if (image) gsap.to(image, { y: 0, autoAlpha: 1, duration: 0.82, ease: SETTINGS.easing, delay: 0.1 });
  }

  // Small, deterministic node field. It only redraws on pointer movement and pauses offscreen.
  function setupNetworkCanvas() {
    const canvas = document.querySelector('.network-canvas');
    const hero = document.querySelector('.hero');
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !hero || !context || isReduced() || !finePointer.matches) return;

    let width = 0;
    let height = 0;
    let nodes = [];
    let pointer = { x: -1000, y: -1000 };
    let inViewport = false;
    let visible = false;
    let sized = false;
    let raf = 0;

    const buildNodes = () => {
      const cols = Math.max(6, Math.ceil(width / 128));
      const rows = Math.max(4, Math.ceil(height / 112));
      nodes = [];
      for (let row = 0; row <= rows; row += 1) {
        for (let col = 0; col <= cols; col += 1) {
          const jitterX = Math.sin((row + 1) * (col + 3) * 1.7) * 18;
          const jitterY = Math.cos((row + 2) * (col + 1) * 1.2) * 16;
          nodes.push({ x: (col / cols) * width + jitterX, y: (row / rows) * height + jitterY });
        }
      }
    };
    const resize = () => {
      const box = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildNodes();
      sized = true;
      draw();
    };
    const draw = () => {
      raf = 0;
      if (!visible || document.hidden || isReduced()) return;
      context.clearRect(0, 0, width, height);
      context.lineWidth = 0.65;
      nodes.forEach((point, index) => {
        const nearby = nodes.slice(index + 1).filter((other) => Math.hypot(point.x - other.x, point.y - other.y) < SETTINGS.networkRadius);
        nearby.forEach((other) => {
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          const nearPointer = Math.hypot(point.x - pointer.x, point.y - pointer.y) < 190 || Math.hypot(other.x - pointer.x, other.y - pointer.y) < 190;
          context.strokeStyle = nearPointer ? `rgba(24,216,226,${0.08 + (1 - distance / SETTINGS.networkRadius) * 0.24})` : `rgba(24,216,226,${0.035 + (1 - distance / SETTINGS.networkRadius) * 0.07})`;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        });
        const glow = Math.max(0, 1 - Math.hypot(point.x - pointer.x, point.y - pointer.y) / 150);
        context.fillStyle = `rgba(90,239,245,${0.12 + glow * 0.62})`;
        context.beginPath();
        context.arc(point.x, point.y, 1 + glow * 1.25, 0, Math.PI * 2);
        context.fill();
      });
    };
    const schedule = () => { if (!raf && visible && !isReduced()) raf = requestAnimationFrame(draw); };
    const onMove = (event) => {
      const box = hero.getBoundingClientRect();
      pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
      schedule();
    };

    const visibilityObserver = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      visible = inViewport && !document.hidden;
      if (visible && !sized) resize();
      else if (visible) schedule();
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0.01 }) : null;
    if (visibilityObserver) visibilityObserver.observe(hero);
    else { inViewport = true; visible = !document.hidden; }
    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', () => { pointer = { x: -1000, y: -1000 }; schedule(); }, { passive: true });
    document.addEventListener('visibilitychange', () => { visible = inViewport && !document.hidden; if (visible) schedule(); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (visible) resize(); }).observe(hero);
    else window.addEventListener('resize', () => { if (visible) resize(); }, { passive: true });
    if (!visibilityObserver) resize();
  }

  // UV edge light and restrained perspective are limited to the active desktop target.
  function setupSpotlightAndTilt() {
    if (!finePointer.matches || isReduced()) return;
    document.querySelectorAll('.solution-row,.sector-item,.contact-card').forEach((element) => {
      let bounds;
      element.addEventListener('pointerenter', () => {
        bounds = element.getBoundingClientRect();
        element.classList.add('is-lit');
      }, { passive: true });
      element.addEventListener('pointermove', (event) => {
        if (isReduced()) return;
        if (!bounds) bounds = element.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        element.style.setProperty('--uv-x', `${x}px`);
        element.style.setProperty('--uv-y', `${y}px`);
        if (element.matches('.solution-row')) {
          const tiltX = ((y / bounds.height) - 0.5) * -1.2;
          const tiltY = ((x / bounds.width) - 0.5) * 1.2;
          element.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
          element.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
          element.classList.add('is-tilting');
        }
      }, { passive: true });
      element.addEventListener('pointerleave', () => {
        bounds = null;
        element.classList.remove('is-lit', 'is-tilting');
        element.style.removeProperty('--tilt-x');
        element.style.removeProperty('--tilt-y');
      }, { passive: true });
    });
  }

  function setupCursorAndMagnetics() {
    if (!finePointer.matches || isReduced()) return;
    document.querySelectorAll('.magnetic').forEach((element) => {
      let bounds;
      element.addEventListener('pointerenter', () => { bounds = element.getBoundingClientRect(); }, { passive: true });
      element.addEventListener('pointermove', (event) => {
        if (isReduced()) return;
        if (!bounds) bounds = element.getBoundingClientRect();
        const dx = (event.clientX - bounds.left - bounds.width / 2) * SETTINGS.magneticStrength;
        const dy = (event.clientY - bounds.top - bounds.height / 2) * SETTINGS.magneticStrength;
        element.style.setProperty('--mag-x', `${Math.max(-5, Math.min(5, dx)).toFixed(1)}px`);
        element.style.setProperty('--mag-y', `${Math.max(-4, Math.min(4, dy)).toFixed(1)}px`);
      }, { passive: true });
      element.addEventListener('pointerleave', () => {
        bounds = null;
        element.style.setProperty('--mag-x', '0px');
        element.style.setProperty('--mag-y', '0px');
      }, { passive: true });
    });
  }

  function setupRipples() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('.button,.header-cta');
      if (!target || isReduced()) return;
      const rect = target.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.setAttribute('aria-hidden', 'true');
      ripple.style.left = `${event.clientX ? event.clientX - rect.left : rect.width / 2}px`;
      ripple.style.top = `${event.clientY ? event.clientY - rect.top : rect.height / 2}px`;
      target.append(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  }

  function setupCounters() {
    const counter = document.querySelector('.proof-main>strong');
    if (!counter || isReduced()) return;
    const target = Number((counter.textContent.match(/\d+/) || [0])[0]);
    const formatter = new Intl.NumberFormat('pt-BR');
    const render = (value) => { counter.textContent = `+${formatter.format(value)}`; };
    counter.setAttribute('aria-label', 'Mais de 100 clientes corporativos atendidos');
    counter.classList.add('counter-ready');
    let played = false;
    const run = () => {
      if (played || isReduced()) return;
      played = true;
      if (canUseGsap) {
        const state = { value: 0 };
        gsap.to(state, { value: target, duration: SETTINGS.counterDuration, ease: 'power2.out', onUpdate: () => render(Math.round(state.value)) });
        return;
      }
      const started = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - started) / (SETTINGS.counterDuration * 1000));
        render(Math.round(target * (1 - ((1 - t) ** 4))));
        if (t < 1) requestAnimationFrame(frame);
      };
      render(0);
      requestAnimationFrame(frame);
    };
    if (canUseGsap) ScrollTrigger.create({ trigger: counter, start: 'top 88%', once: true, onEnter: run });
    else if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        run();
        observer.disconnect();
      }, { threshold: 0.4 });
      observer.observe(counter);
    } else run();
  }

  function setupScrollSpy() {
    const navLinks = [...document.querySelectorAll('.main-nav a[href^="#"]')];
    const sections = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    if (!('IntersectionObserver' in window) || !sections.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        if (link.getAttribute('href') === `#${visible.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-18% 0px -66% 0px', threshold: [0, 0.15, 0.35, 0.6] });
    sections.forEach((section) => observer.observe(section));
  }

  function setupSectionParallax() {
    if (!canUseGsap || isReduced() || !finePointer.matches) return;
    const lines = document.querySelector('.hero-lines--hero');
    if (!lines) return;
    gsap.to(lines, {
      y: 18,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
    });
  }

  function setupScrollChrome() {
    const header = document.querySelector('.site-header');
    const progress = document.querySelector('.scroll-progress span');
    const paint = () => {
      scrollFrame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.transform = `scaleX(${scrollable > 0 ? window.scrollY / scrollable : 0})`;
      header?.classList.toggle('is-scrolled', window.scrollY > 22);
    };
    window.addEventListener('scroll', () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener('resize', paint, { passive: true });
    paint();
  }

  function setupMotionToggle() {
    const toggle = document.querySelector('.motion-toggle');
    if (!toggle) return;
    const apply = (next) => {
      reducedByUser = next;
      root.classList.toggle('motion-reduced', next);
      toggle.setAttribute('aria-pressed', String(next));
      toggle.textContent = next ? 'Ativar movimento' : 'Reduzir movimento';
      if (next) {
        document.querySelectorAll('.reveal').forEach((item) => item.classList.add('is-visible'));
        document.querySelectorAll('.section-shell').forEach((item) => item.classList.add('is-visible'));
        sectionObserver?.disconnect();
        if (lenis) lenis.stop();
        if (canUseGsap) ScrollTrigger.getAll().forEach((trigger) => trigger.disable(false));
      } else {
        if (lenis && !reduceQuery.matches) lenis.start();
        if (!isReduced()) {
          if (canUseGsap) ScrollTrigger.getAll().forEach((trigger) => trigger.enable());
          else revealSections();
        }
      }
    };
    toggle.addEventListener('click', () => apply(!reducedByUser));
    reduceQuery.addEventListener('change', () => {
      if (reduceQuery.matches) {
        document.querySelectorAll('.reveal').forEach((item) => item.classList.add('is-visible'));
        if (lenis) lenis.stop();
        if (canUseGsap) ScrollTrigger.getAll().forEach((trigger) => trigger.disable(false));
      } else if (!reducedByUser) {
        if (lenis) lenis.start();
        if (canUseGsap) ScrollTrigger.getAll().forEach((trigger) => trigger.enable());
      }
    });
  }

  setupScrollChrome();
  setupScrollSpy();
  setupMotionToggle();
  setupRipples();
  setupSmoothScroll();
  setupSpotlightAndTilt();
  setupCursorAndMagnetics();
  setupNetworkCanvas();
  setupCounters();

  animateHero();
  revealSections();
  setupSectionParallax();
  if (canUseGsap) ScrollTrigger.refresh();
})();
