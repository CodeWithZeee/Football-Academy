/**
 * ZEE Football Academy – main.js
 *
 * Architecture:
 *  1. Preload 224 hero frames, show progress in loader.
 *  2. On load complete, unlock scroll, init hero scrub.
 *  3. Hero scrub: pinned via position:sticky inside #hero-track (400vh tall).
 *     Scroll 0→300vh = frame 0→223, then flash + hand off to stack panels.
 *  4. Stack panels (#stack-container): CSS sticky handles the visual overlap.
 *     JS adds per-panel scale/dim depth illusion as each section scrolls away.
 *  5. IntersectionObserver for timeline items, counter animation, etc.
 *  6. 3D tilt on rule cards.
 *  7. Parallax on About image column.
 */

document.addEventListener('DOMContentLoaded', () => {

    /* ─── CONFIG ─────────────────────────────────────────── */
    const FRAME_COUNT = 205;
    const FRAME_DIR = 'Sequence';
    const FRAME_PREFIX = 'ezgif-frame-';
    const FRAME_EXT = '.jpg';
    // Hero scroll track height == scrub distance so About slides in the instant
    // the last frame lands. No dead-zone, no white gap.
    const SCRUB_VH = 3;   // 3 × 100vh of scroll = full frame scrub
    const HERO_TRACK_VH = 3;   // must equal SCRUB_VH – eliminates the gap

    /* ─── ELEMENTS ───────────────────────────────────────── */
    const loader = document.getElementById('loader');
    const loadProgress = document.getElementById('load-progress');
    const canvas = document.getElementById('hero-canvas');
    const ctx = canvas.getContext('2d');
    const heroTrack = document.getElementById('hero-track');
    const heroHeading = document.getElementById('hero-heading');
    const heroSubheading = document.getElementById('hero-subheading');
    const heroCta = document.getElementById('hero-cta');
    const flashOverlay = document.getElementById('flash-overlay');
    const aboutParallax = document.getElementById('about-parallax');
    const stackContainer = document.getElementById('stack-container');
    const stackPanels = document.querySelectorAll('.stack-panel');

    /* ─── STATE ──────────────────────────────────────────── */
    const frames = [];
    let loadedCount = 0;
    let currentFrame = -1;
    let flashFired = false;
    let rafPending = false;
    let countersAnimated = false;   // guard: trigger counters only once
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ─────────────────────────────────────────────────────
       1. CANVAS RESIZE
    ───────────────────────────────────────────────────── */
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (currentFrame >= 0) drawFrame(currentFrame);
    }
    window.addEventListener('resize', resizeCanvas, { passive: true });
    resizeCanvas();

    /* ─────────────────────────────────────────────────────
       2. PRELOAD FRAMES
    ───────────────────────────────────────────────────── */
    function pad(n, size) {
        let s = String(n);
        while (s.length < size) s = '0' + s;
        return s;
    }

    function preloadFrames() {
        for (let i = 1; i <= FRAME_COUNT; i++) {
            const img = new Image();
            img.src = `${FRAME_DIR}/${FRAME_PREFIX}${pad(i, 3)}${FRAME_EXT}`;
            img.onload = onFrameLoad;
            img.onerror = onFrameLoad;   // count even on error to unblock
            frames.push(img);
        }
    }

    function onFrameLoad() {
        loadedCount++;
        const pct = Math.floor((loadedCount / FRAME_COUNT) * 100);
        loadProgress.textContent = pct + '%';
        if (loadedCount === FRAME_COUNT) initApp();
    }

    /* ─────────────────────────────────────────────────────
       3. INIT APP  (called once all frames ready)
    ───────────────────────────────────────────────────── */
    function initApp() {
        // Set hero track height dynamically in case vh changes
        heroTrack.style.height = `${HERO_TRACK_VH * 100}vh`;

        // Draw first frame immediately
        drawFrame(0);

        // Fade out loader
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            document.body.style.overflowY = 'auto';  // unlock scroll
        }, 650);
    }

    /* ─────────────────────────────────────────────────────
       4. DRAW FRAME – covers canvas (object-fit: cover)
    ───────────────────────────────────────────────────── */
    function drawFrame(index) {
        const img = frames[index];
        if (!img || !img.complete || img.naturalWidth === 0) return;
        currentFrame = index;
        const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, x, y, w, h);
    }

    /* ─────────────────────────────────────────────────────
       5. SCROLL HANDLER  (RAF-throttled)
    ───────────────────────────────────────────────────── */
    window.addEventListener('scroll', onScroll, { passive: true });

    function onScroll() {
        if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(processScroll);
        }
    }

    function processScroll() {
        rafPending = false;
        const scrollY = window.scrollY;
        const vh = window.innerHeight;

        // ── 5a. Hero scrub ────────────────────────────────
        const scrubEnd = SCRUB_VH * vh;            // 300vh
        const scrubProgress = Math.min(1, scrollY / scrubEnd); // 0→1

        // Map to frame index
        const frameIdx = Math.min(FRAME_COUNT - 1, Math.floor(scrubProgress * FRAME_COUNT));
        if (frameIdx !== currentFrame) drawFrame(frameIdx);

        // ── 5b. Hero text reveals (staggered blur-focus-in) ───
        if (scrubProgress > 0.14) {
            if (!heroHeading._revealed) {
                heroHeading._revealed = true;
                heroHeading.classList.add('visible');
            }
        } else {
            heroHeading._revealed = false;
            heroHeading.classList.remove('visible');
        }

        if (scrubProgress > 0.34) {
            if (!heroSubheading._revealed) {
                heroSubheading._revealed = true;
                setTimeout(() => heroSubheading.classList.add('visible'), 150);
            }
        } else {
            heroSubheading._revealed = false;
            heroSubheading.classList.remove('visible');
        }

        if (scrubProgress > 0.54) {
            if (!heroCta._revealed) {
                heroCta._revealed = true;
                setTimeout(() => heroCta.classList.add('visible'), 250);
            }
        } else {
            heroCta._revealed = false;
            heroCta.classList.remove('visible');
        }

        // ── 5c. Subtle flash at scrub end ─────────────────
        // Keep opacity very low so it reads as a light bloom rather than a
        // blinding white-screen interrupt. About slides in simultaneously.
        if (scrubProgress >= 1 && !flashFired) {
            flashFired = true;
            flashOverlay.style.transition = 'opacity 0.06s ease-out';
            flashOverlay.style.opacity = '0.18';          // soft glow, not white-out
            setTimeout(() => {
                flashOverlay.style.transition = 'opacity 0.4s ease-in';
                flashOverlay.style.opacity = '0';
            }, 60);
        }
        if (scrubProgress < 0.98 && flashFired) {
            flashFired = false;   // allow re-trigger on scroll-back
        }

        // ── 5d. Stack panel depth effects ─────────────────
        stackPanels.forEach(panel => updatePanelDepth(panel, scrollY, vh));

        // ── 5e. About parallax ────────────────────────────
        if (aboutParallax) {
            const rect = aboutParallax.getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < vh) {
                const inner = aboutParallax.querySelector('.col-image-inner');
                if (inner) {
                    const ratio = 1 - rect.top / vh;
                    const shift = ratio * 40 - 20;
                    inner.style.transform = `translateY(${shift}px)`;
                }
            }
        }

        // ── 5f. Stats counters – fire once when panel is active ──
        // IntersectionObserver is unreliable with sticky panels (they are
        // always technically "in" the viewport). Use rect position instead.
        if (!countersAnimated) {
            const statsPanel = document.getElementById('stats');
            if (statsPanel) {
                const sr = statsPanel.getBoundingClientRect();
                // Panel is the active one when its top is near the viewport top
                if (sr.top <= vh * 0.25 && sr.top > -vh * 0.5) {
                    countersAnimated = true;
                    document.querySelectorAll('.counter').forEach(el => animateCounter(el));
                }
            }
        }
    }

    /* Helper: add/remove .visible class for hero text reveals */
    function setReveal(el, show) {
        if (!el) return;
        if (show) el.classList.add('visible');
        else el.classList.remove('visible');
    }

    /* ─────────────────────────────────────────────────────
       6. PER-PANEL DEPTH EFFECT
       As a panel is pinned and the NEXT panel scrolls over it,
       we scale it down slightly and dim it.
    ───────────────────────────────────────────────────── */
    function updatePanelDepth(panel, scrollY, vh) {
        if (prefersReduced) return;

        const rect = panel.getBoundingClientRect();
        const dimOverlay = panel.querySelector('.panel-dim-overlay');

        // How far the panel has been "scrolled under" the next one.
        // When rect.top == 0 panel is flush top → no outgoing effect yet.
        // When rect.top < 0 the next panel is covering it.
        // We don't want to affect a panel before it's been scrolled to.

        // "coverage" = how much of this panel has disappeared above viewport top
        // Only applies while the panel is sticky (i.e., rect.bottom >= 0)
        const coverage = -rect.top;   // 0 = just arrived at top, >0 = being scrolled under

        if (coverage <= 0) {
            // Panel not yet covered — reset
            panel.style.transform = '';
            if (dimOverlay) dimOverlay.style.background = 'rgba(0,0,0,0)';
            return;
        }

        // Normalise: progress of coverage 0→1 over one viewport height
        const progress = Math.min(1, coverage / vh);

        // Scale outgoing panel slightly (0.98 at full coverage)
        const scale = 1 - (progress * 0.02);

        // Dim the outgoing panel up to 50% opacity
        const dimAlpha = progress * 0.5;

        panel.style.transform = `scale(${scale.toFixed(4)})`;
        panel.style.transformOrigin = 'center center';

        if (dimOverlay) {
            dimOverlay.style.background = `rgba(0,0,0,${dimAlpha.toFixed(3)})`;
        }
    }

    /* ─────────────────────────────────────────────────────
       7. INTERSECTION OBSERVER – Timeline items
    ───────────────────────────────────────────────────── */
    const timelineObserver = new IntersectionObserver(entries => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                // Staggered reveal
                setTimeout(() => entry.target.classList.add('visible'), i * 120);
            }
        });
    }, { threshold: 0.2 });

    document.querySelectorAll('.timeline-item').forEach(el => timelineObserver.observe(el));

    /* ─────────────────────────────────────────────────────
       8. STAT COUNTERS  (triggered from scroll loop above)
       Note: IntersectionObserver is not used here because
       position:sticky panels appear "in viewport" even when
       hidden behind other panels, causing premature firing.
    ───────────────────────────────────────────────────── */

    function animateCounter(el) {
        const target = +el.dataset.target;
        const suffix = el.dataset.suffix || '';
        // The stat-number wrapper (h3) — we'll add .counted to it
        const numberEl = el.closest('.stat-number') || el.parentElement;

        if (prefersReduced) {
            el.textContent = target + suffix;
            numberEl && numberEl.classList.add('counted');
            return;
        }

        const duration = 1800;
        const start = performance.now();

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(1, elapsed / duration);
            const eased = 1 - Math.pow(1 - progress, 3);  // ease-out cubic
            el.textContent = Math.round(eased * target) + (progress >= 1 ? suffix : '');
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                // Counter finished — fire glow pulse on the h3 wrapper
                if (numberEl) {
                    numberEl.classList.remove('counted'); // reset in case re-triggered
                    void numberEl.offsetWidth;            // force reflow to restart animation
                    numberEl.classList.add('counted');
                }
            }
        }
        requestAnimationFrame(update);
    }

    /* ─────────────────────────────────────────────────────
       9. 3D TILT – Rule Cards (with light-source highlight)
    ───────────────────────────────────────────────────── */
    document.querySelectorAll('.tilt-card').forEach(card => {
        // Add a radial highlight layer inside the card for the light-source illusion
        const highlight = document.createElement('div');
        highlight.style.cssText = `
            position: absolute; inset: 0;
            border-radius: inherit;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            background: radial-gradient(circle at 50% 50%, rgba(201,168,76,0.18) 0%, transparent 65%);
            z-index: 2;
        `;
        card.appendChild(highlight);

        card.addEventListener('mousemove', e => {
            if (prefersReduced) return;
            const r = card.getBoundingClientRect();
            const xPct = (e.clientX - r.left) / r.width;   // 0 → 1
            const yPct = (e.clientY - r.top) / r.height;  // 0 → 1

            // Tilt: max ±12 degrees
            const rx = (yPct - 0.5) * -14;
            const ry = (xPct - 0.5) * 14;

            card.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
            card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;

            // Move highlight to follow cursor
            highlight.style.background =
                `radial-gradient(circle at ${xPct * 100}% ${yPct * 100}%, rgba(201,168,76,0.2) 0%, transparent 60%)`;
            highlight.style.opacity = '1';
        });

        card.addEventListener('mouseleave', () => {
            if (prefersReduced) return;
            card.style.transition = 'transform 0.55s cubic-bezier(0.25,1,0.5,1), box-shadow 0.4s ease, border-color 0.3s ease';
            card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
            highlight.style.opacity = '0';
        });
    });

    /* ─────────────────────────────────────────────────────
       START
    ───────────────────────────────────────────────────── */
    preloadFrames();
});
