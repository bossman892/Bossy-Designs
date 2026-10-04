/* ==========================================================================
   BOSSY DESIGNS — REVIEWS.JS
   Real-time client feedback feed for the Work page
   Location: Nairobi, Kenya [254]
   Version: 2025.2.0
   --------------------------------------------------------------------------
   HOW "REAL TIME" WORKS HERE
     1. Feed sources are merged at runtime: CONFIG.seed (curated quotes you
        control) + anything visitors publish through the form (localStorage)
        + an optional remote endpoint / Google Places pull (see CONFIG).
     2. Published reports hit the DOM instantly and are broadcast to every
        other open tab through the `storage` event.
     3. Timestamps, the running average, the distribution and the sync clock
        all re-render on a live tick, so nothing on screen ever goes stale.
   ========================================================================== */

(function () {
  'use strict';

  /* ==========================================================================
     CONFIG
     ========================================================================== */
  const CONFIG = {
    rootSelector: '[data-reviews-root]',
    storageKey: 'bossy.reviews.v1',

    // Autoplay cadence for the feed (ms)
    autoplayMs: 6500,

    // Re-sync the remote source on this interval (ms)
    refreshMs: 8000,

    // Maximum reports rendered at once
    maxCards: 30,

    // Optional live source. Point `endpoint` at any JSON that returns
    // { reviews: [{ name, rating, quote, project, createdAt, source }] }
    // Leave null to run fully offline.
    endpoint: null,

    // Optional Google Places pull. Requires a browser-restricted key with
    // the Places API (New) enabled, plus the Place ID of the business profile.
    google: {
      placeId: null,
      apiKey: null
    },

    // WhatsApp relay for submitted reports awaiting verification
    whatsappNumber: '254796625193',

    // Curated baseline feed — currently empty. The live feed fills itself from
    // visitor submissions (and any configured endpoint / Google Places pull).
    // Drop real client quotes in here any time to pin them to the top:
    //   { name, rating, quote, project, createdAt, verified: true }
    seed: []
  };

  /* ==========================================================================
     UTILITIES
     ========================================================================== */
  const $  = (selector, context) => (context || document).querySelector(selector);
  const $$ = (selector, context) => Array.from((context || document).querySelectorAll(selector));

  const on = (el, event, handler, options) => {
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener(event, handler, options || false);
    }
  };

  const reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function toTime(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value > 1e11 ? value : value * 1000;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function clampRating(value) {
    const rating = parseInt(value, 10);
    if (Number.isNaN(rating)) return 5;
    return Math.min(5, Math.max(1, rating));
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initialsOf(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return 'B';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function relativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 0) return 'JUST NOW';
    const sec = Math.floor(diff / 1000);
    if (sec < 45) return 'JUST NOW';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + 'M AGO';
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return hrs + 'H AGO';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + 'D AGO';
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return weeks + 'W AGO';
    return new Date(timestamp).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).toUpperCase();
  }

  function starMarkup(rating, extraClass) {
    let html = '';
    for (let i = 1; i <= 5; i += 1) {
      const on = i <= rating ? ' is-on' : '';
      html +=
        '<span class="material-symbols-outlined text-[18px] leading-none review-star' +
        on +
        (extraClass ? ' ' + extraClass : '') +
        '" style="font-variation-settings:\'FILL\' 1" aria-hidden="true">star</span>';
    }
    return html;
  }

  /* ==========================================================================
     STATE
     ========================================================================== */
  const state = {
    reviews: [],
    index: 0,
    pages: 1,
    rating: 5,
    timer: null,
    resumeTimer: null,
    progress: null,
    progressFrame: 0,
    lastClock: '',
    timeCache: new WeakMap(),
    resumeAt: 0,
    syncing: false
  };

  /* ==========================================================================
     DATA LAYER
     ========================================================================== */
  const Store = (function () {
    function readLocal() {
      try {
        const raw = window.localStorage.getItem(CONFIG.storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : parsed.reviews || [];
        return list.map((entry) => normalise(entry, 'submission')).filter(Boolean);
      } catch (err) {
        return [];
      }
    }

    function writeLocal(reviews) {
      try {
        window.localStorage.setItem(CONFIG.storageKey, JSON.stringify(reviews.slice(0, 50)));
        return true;
      } catch (err) {
        return false;
      }
    }

    function normalise(entry, fallbackSource) {
      if (!entry || typeof entry !== 'object') return null;
      const quote = String(entry.quote || entry.text || '').trim();
      const name = String(entry.name || entry.author || 'CLIENT').trim();
      if (!quote) return null;
      return {
        id: String(entry.id || name + '-' + (entry.createdAt || Date.now()) + '-' + Math.random().toString(36).slice(2, 7)),
        name: name.slice(0, 48),
        rating: clampRating(entry.rating),
        quote: quote.slice(0, 420),
        project: String(entry.project || 'Bossy Designs').slice(0, 40),
        createdAt: toTime(entry.createdAt) || Date.now(),
        verified: entry.verified === true,
        source: entry.source || fallbackSource
      };
    }

    async function fetchRemote() {
      // Optional Google Places pull
      if (CONFIG.google.placeId && CONFIG.google.apiKey) {
        try {
          const url =
            'https://places.googleapis.com/v1/places/' +
            encodeURIComponent(CONFIG.google.placeId) +
            '/reviews?pageSize=20';
          const response = await fetch(url, {
            headers: {
              'X-Goog-Api-Key': CONFIG.google.apiKey,
              'X-Goog-FieldMask': 'reviews'
            }
          });
          if (response.ok) {
            const data = await response.json();
            return (data.reviews || [])
              .filter((r) => r && r.text && r.text.text)
              .map((r) =>
                normalise(
                  {
                    name: (r.authorAttribution && r.authorAttribution.displayName) || 'GOOGLE REVIEW',
                    rating: r.rating || 5,
                    quote: r.text.text,
                    project: 'GOOGLE PROFILE',
                    createdAt: r.publishTime || Date.now(),
                    verified: true,
                    source: 'google'
                  },
                  'google'
                )
              )
              .filter(Boolean);
          }
        } catch (err) {
          if (window.console && console.warn) console.warn('[Reviews] Google sync failed:', err);
        }
      }

      // Optional custom JSON endpoint
      if (CONFIG.endpoint) {
        try {
          const response = await fetch(CONFIG.endpoint, { cache: 'no-store' });
          if (!response.ok) return [];
          const data = await response.json();
          const list = Array.isArray(data) ? data : data.reviews || [];
          return list.map((entry) => normalise(entry, 'remote')).filter(Boolean);
        } catch (err) {
          if (window.console && console.warn) console.warn('[Reviews] Endpoint sync failed:', err);
          return [];
        }
      }

      return [];
    }

    function seed() {
      return CONFIG.seed.map((entry) => normalise(entry, 'seed')).filter(Boolean);
    }

    function merge() {
      const seen = {};
      const merged = [];
      seed()
        .concat(readLocal())
        .concat(state.remote || [])
        .sort((a, b) => b.createdAt - a.createdAt)
        .forEach((review) => {
          if (seen[review.id]) return;
          seen[review.id] = true;
          merged.push(review);
        });
      return merged.slice(0, CONFIG.maxCards);
    }

    async function sync() {
      if (state.syncing) return;
      state.syncing = true;
      state.remote = await fetchRemote();
      state.syncing = false;
      return merge();
    }

    function publish(review) {
      const local = readLocal();
      local.unshift(review);
      writeLocal(local);
      return merge();
    }

    return { sync: sync, publish: publish, merge: merge };
  })();

  /* ==========================================================================
     LIVE CLOCK + RELATIVE TIME TICKER
     ========================================================================== */
  const Clock = (function () {
    function tick() {
      const now = new Date();
      const stamp = now.toLocaleTimeString('en-GB', { hour12: false });
      if (stamp !== state.lastClock) {
        state.lastClock = stamp;
        $$('[data-reviews-clock]').forEach((el) => {
          el.textContent = stamp;
        });
      }

      $$('[data-slot="time"]').forEach((el) => {
        const stampValue = el.getAttribute('data-timestamp');
        if (!stampValue) return;
        const next = relativeTime(parseInt(stampValue, 10));
        if (state.timeCache.get(el) !== next) {
          state.timeCache.set(el, next);
          el.textContent = next;
        }
      });

      $$('[data-reviews-lamp]').forEach((el) => {
        el.classList.toggle('bg-secondary-container', navigator.onLine);
        el.classList.toggle('bg-primary-container', !navigator.onLine);
      });

      $$('[data-reviews-mode]').forEach((el) => {
        const live = state.reviews.some((r) => r.source === 'submission' || r.source === 'remote' || r.source === 'google');
        const label = !navigator.onLine
          ? 'FEED: OFFLINE CACHE'
          : live
            ? 'FEED: LIVE'
            : 'FEED: CURATED';
        if (el.textContent !== label) el.textContent = label;
      });
    }

    function init() {
      tick();
      window.setInterval(tick, 1000);
      on(window, 'online', tick);
      on(window, 'offline', tick);
    }

    return { init: init, tick: tick };
  })();

  /* ==========================================================================
     AGGREGATE PANEL
     ========================================================================== */
  const Aggregate = (function () {
    function render() {
      const reviews = state.reviews;
      const count = reviews.length;

      const averageEl = $('[data-reviews-average]');
      const starsEl = $('[data-reviews-average-stars]');
      const countEl = $('[data-reviews-count]');
      const distEl = $('[data-reviews-distribution]');

      const average = count
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / count
        : 0;

      if (averageEl) averageEl.textContent = count ? average.toFixed(1) : '—';
      if (starsEl) {
        starsEl.innerHTML = starMarkup(count ? Math.round(average) : 0);
        starsEl.setAttribute('aria-label', 'Average rating ' + (count ? average.toFixed(1) : '0') + ' out of 5');
      }
      if (countEl) countEl.textContent = count;

      if (!distEl) return;
      const buckets = [5, 4, 3, 2, 1].map((star) => ({
        star: star,
        total: reviews.filter((r) => r.rating === star).length
      }));

      distEl.innerHTML = buckets
        .map(function (bucket) {
          const pct = count ? Math.round((bucket.total / count) * 100) : 0;
          return (
            '<div class="flex items-center gap-space-sm">' +
              '<span class="font-code-micro text-code-micro text-outline w-8 shrink-0">' + bucket.star +
              '<span class="material-symbols-outlined text-[11px] align-middle" style="font-variation-settings:\'FILL\' 1">star</span></span>' +
              '<span class="flex-1 h-1.5 bg-surface-container-highest overflow-hidden">' +
                '<span class="review-bar-fill block h-full w-0 bg-secondary-container" data-width="' + pct + '"></span>' +
              '</span>' +
              '<span class="font-code-micro text-code-micro text-on-surface-variant w-8 text-right shrink-0">' + bucket.total + '</span>' +
            '</div>'
          );
        })
        .join('');

      $$('.review-bar-fill', distEl).forEach(function (bar) {
        bar.style.width = '0%';
        state.progressFrame = requestAnimationFrame(function () {
          bar.style.width = bar.getAttribute('data-width') + '%';
        });
      });
    }

    return { render: render };
  })();

  /* ==========================================================================
     FEED CAROUSEL
     ========================================================================== */
  const Feed = (function () {
    let track = null;
    let template = null;
    let prevBtn = null;
    let nextBtn = null;
    let dotsEl = null;
    let positionEl = null;
    let totalEl = null;
    let progressEl = null;
    let scrollFrame = 0;

    function step() {
      if (!track || !track.children.length) return 1;
      const first = track.children[0];
      const styles = window.getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      const width = first.getBoundingClientRect().width || first.offsetWidth || 0;
      const total = width + gap;
      return total > 0 ? total : 1;
    }

    function pages() {
      if (!track || !track.children.length) return 1;
      const scrollable = track.scrollWidth || track.clientWidth || 0;
      if (scrollable <= 0) return 1;
      return Math.max(1, Math.round(scrollable / step()) || 1);
    }

    function clampIndex(value) {
      const safe = Number.isFinite(value) ? value : 0;
      return Math.min(pages() - 1, Math.max(0, safe));
    }

    function buildCard(review, isNew) {
      const node = template.content.firstElementChild.cloneNode(true);
      const slot = (name) => $('[data-slot="' + name + '"]', node);

      const stars = slot('stars');
      stars.innerHTML = starMarkup(review.rating);
      stars.setAttribute('aria-label', 'Rated ' + review.rating + ' out of 5');

      const badge = slot('badge');
      if (review.verified) {
        badge.textContent = 'VERIFIED';
        badge.classList.remove('text-secondary');
        badge.classList.add('text-secondary-container');
      } else if (review.source === 'submission') {
        badge.textContent = 'NEW';
        badge.classList.remove('text-secondary');
        badge.classList.add('text-primary-container');
      } else if (review.source === 'google') {
        badge.textContent = 'GOOGLE';
      } else {
        badge.textContent = 'FEED';
      }

      slot('quote').textContent = '“' + review.quote + '”';
      slot('initials').textContent = initialsOf(review.name);
      slot('name').textContent = review.name;
      slot('meta').textContent = review.verified ? 'VERIFIED CLIENT' : 'CLIENT REPORT';
      slot('project').textContent = review.project;

      const time = slot('time');
      time.setAttribute('data-timestamp', String(review.createdAt));
      time.textContent = relativeTime(review.createdAt);

      if (isNew) node.classList.add('is-new');
      return node;
    }

    function renderDots() {
      if (!dotsEl) return;
      const total = pages();
      dotsEl.innerHTML = '';
      for (let i = 0; i < total; i += 1) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'review-dot w-2.5 h-2.5 border border-surface-container-highest bg-surface-container-lowest transition-colors';
        dot.setAttribute('aria-label', 'Go to review ' + (i + 1) + ' of ' + total);
        dot.setAttribute('aria-current', i === state.index ? 'true' : 'false');
        on(dot, 'click', function () {
          goTo(i);
          hold(8000);
        });
        dotsEl.appendChild(dot);
      }
    }

    function syncPosition() {
      const total = pages();
      if (positionEl) positionEl.textContent = String(state.index + 1).padStart(2, '0');
      if (totalEl) totalEl.textContent = String(total).padStart(2, '0');
      $$('.review-dot', dotsEl).forEach(function (dot, i) {
        dot.setAttribute('aria-current', i === state.index ? 'true' : 'false');
      });
    }

    function goTo(index, instant) {
      if (!track) return;
      state.index = clampIndex(index);
      track.scrollTo({
        left: state.index * step(),
        behavior: instant || reduceMotion.matches ? 'auto' : 'smooth'
      });
      syncPosition();
    }

    function detect() {
      if (!track) return;
      const next = clampIndex(Math.round(track.scrollLeft / step()));
      if (next !== state.index) {
        state.index = next;
        syncPosition();
      }
    }

    function startProgress() {
      if (!progressEl || reduceMotion.matches) return;
      progressEl.classList.remove('is-running');
      void progressEl.offsetWidth;
      progressEl.style.setProperty('--review-progress', CONFIG.autoplayMs + 'ms');
      progressEl.classList.add('is-running');
    }

    function stopProgress() {
      if (progressEl) progressEl.classList.remove('is-running');
    }

    function play() {
      stop();
      if (state.resumeTimer) {
        window.clearTimeout(state.resumeTimer);
        state.resumeTimer = null;
      }
      state.resumeAt = 0;
      if (state.reviews.length < 2) return;
      startProgress();
      state.timer = window.setInterval(function () {
        goTo(state.index + 1 >= pages() ? 0 : state.index + 1);
        startProgress();
      }, CONFIG.autoplayMs);
    }

    function stop() {
      if (state.timer) window.clearInterval(state.timer);
      state.timer = null;
      stopProgress();
    }

    function hold(duration) {
      stop();
      const wait = duration || 0;
      state.resumeAt = wait ? Date.now() + wait : 0;
      if (state.resumeTimer) window.clearTimeout(state.resumeTimer);
      if (wait) {
        state.resumeTimer = window.setTimeout(function () {
          state.resumeAt = 0;
          play();
        }, wait);
      }
    }

    function render(highlightId) {
      if (!track) return;

      const previousId = highlightId;
      track.innerHTML = '';

      if (!state.reviews.length) {
        track.innerHTML = [
          '<div class="w-full shrink-0 border border-dashed border-surface-container-highest bg-surface-container-lowest p-space-lg md:p-space-xl flex flex-col items-start gap-space-sm">',
          '  <span class="material-symbols-outlined text-[34px] leading-none text-outline">forum</span>',
          '  <div class="font-code-micro text-code-micro uppercase tracking-widest text-secondary">// FEED_EMPTY</div>',
          '  <p class="font-body-md text-body-md text-on-surface-variant max-w-md">No client reports yet. Be the first — drop one below and it appears in this feed instantly, on every open tab.</p>',
          '</div>'
        ].join('');
        if (dotsEl) dotsEl.innerHTML = '';
        if (positionEl) positionEl.textContent = '--';
        if (totalEl) totalEl.textContent = '--';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        stopProgress();
        return;
      }

      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;

      const fragment = document.createDocumentFragment();
      state.reviews.forEach(function (review) {
        fragment.appendChild(buildCard(review, previousId && review.id === previousId));
      });
      track.appendChild(fragment);

      state.index = 0;
      renderDots();
      syncPosition();
      track.scrollLeft = 0;
      startProgress();
    }

    function init() {
      const root = $(CONFIG.rootSelector);
      if (!root) return;

      track = $('[data-reviews-track]', root);
      template = $('[data-reviews-template]', root);
      prevBtn = $('[data-reviews-prev]', root);
      nextBtn = $('[data-reviews-next]', root);
      dotsEl = $('[data-reviews-dots]', root);
      positionEl = $('[data-reviews-position]', root);
      totalEl = $('[data-reviews-total]', root);
      progressEl = $('[data-reviews-progress]', root);

      if (!track || !template) return;

      on(prevBtn, 'click', function () {
        goTo(state.index - 1 < 0 ? pages() - 1 : state.index - 1);
        hold(CONFIG.autoplayMs * 2);
      });
      on(nextBtn, 'click', function () {
        goTo(state.index + 1 >= pages() ? 0 : state.index + 1);
        hold(CONFIG.autoplayMs * 2);
      });

      on(track, 'scroll', function () {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(function () {
          scrollFrame = 0;
          detect();
        });
      });

      on(track, 'keydown', function (e) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextBtn && nextBtn.click();
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevBtn && prevBtn.click();
        }
      });

      on(track, 'pointerdown', function () {
        hold(CONFIG.autoplayMs * 2);
      });

      on(track, 'mouseenter', function () {
        if (!state.resumeAt) stop();
      });
      on(track, 'mouseleave', function () {
        if (state.resumeAt && Date.now() >= state.resumeAt) play();
      });

      on(document, 'visibilitychange', function () {
        if (document.hidden) {
          stop();
        } else {
          play();
        }
      });

      on(window, 'resize', function () {
        goTo(state.index, true);
        renderDots();
      });
    }

    return { init: init, render: render, play: play, stop: stop, goTo: goTo, isReady: function () { return !!track; } };
  })();

  /* ==========================================================================
     SUBMISSION FORM
     ========================================================================== */
  const SubmitForm = (function () {
    let form = null;
    let statusEl = null;
    let charEl = null;
    let starWrap = null;

    function setStatus(message, tone) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.style.color = tone === 'error' ? '#ffb4ab' : '#ff7f1c';
    }

    function renderStars() {
      if (!starWrap) return;
      for (let i = 1; i <= 5; i += 1) {
        const input = $('input[value="' + i + '"]', starWrap);
        const label = $('label[for="' + (input ? input.id : '') + '"]', starWrap);
        if (label) {
          const on = i <= state.rating;
          label.classList.toggle('is-on', on);
          label.querySelector('.review-star').classList.toggle('is-on', on);
        }
      }
    }

    function buildStarInput() {
      if (!starWrap) return;
      let html = '';
      for (let i = 1; i <= 5; i += 1) {
        html +=
          '<input type="radio" class="sr-only" name="reviewRating" id="rv-star-' + i + '" value="' + i + '"' +
          (i === state.rating ? ' checked' : '') + '>' +
          '<label for="rv-star-' + i + '" class="review-star-btn cursor-pointer text-outline hover:text-secondary-container transition-colors" title="' + i + ' star' + (i === 1 ? '' : 's') + '">' +
            '<span class="material-symbols-outlined text-[26px] leading-none review-star" style="font-variation-settings:\'FILL\' 1" aria-hidden="true">star</span>' +
            '<span class="sr-only">' + i + ' out of 5</span>' +
          '</label>';
      }
      starWrap.innerHTML = html;
      renderStars();

      $$('input[name="reviewRating"]', starWrap).forEach(function (input) {
        on(input, 'change', function () {
          state.rating = clampRating(input.value);
          renderStars();
        });
      });
    }

    function whatsappUrl(review) {
      const message =
        'Hi Sam, here is my review for Bossy Designs.\n\n' +
        'Name: ' + review.name + '\n' +
        'Project: ' + review.project + '\n' +
        'Rating: ' + review.rating + '/5\n\n' +
        '"' + review.quote + '"';
      return 'https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent(message);
    }

    function handleSubmit(e) {
      e.preventDefault();
      if (!form) return;

      const data = new FormData(form);
      const name = String(data.get('reviewName') || '').trim();
      const quote = String(data.get('reviewQuote') || '').trim();
      const project = String(data.get('reviewProject') || 'Bossy Designs').trim();

      if (!name) {
        setStatus('// ERROR: name required.', 'error');
        return;
      }
      if (quote.length < 12) {
        setStatus('// ERROR: report too short (12+ chars).', 'error');
        return;
      }

      const review = {
        id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        name: name,
        rating: state.rating,
        quote: quote,
        project: project,
        createdAt: Date.now(),
        verified: false,
        source: 'submission'
      };

      const stored = Store.publish(review);
      if (stored.length) {
        state.reviews = stored;
        Aggregate.render();
        Feed.render(review.id);
        Feed.play();
      }

      form.reset();
      if (charEl) charEl.textContent = '0';

      const relay = document.createElement('a');
      relay.href = whatsappUrl(review);
      relay.target = '_blank';
      relay.rel = 'noopener noreferrer';
      relay.className = 'ml-2 underline';
      relay.textContent = '[SEND_TO_WHATSAPP]';
      statusEl.innerHTML = '';
      statusEl.appendChild(document.createTextNode('// PUBLISHED: live in feed. '));
      statusEl.appendChild(relay);
    }

    function init() {
      const root = $(CONFIG.rootSelector);
      if (!root) return;

      form = $('[data-reviews-form]', root);
      statusEl = $('[data-reviews-status]', root);
      charEl = $('[data-reviews-chars]', root);
      starWrap = $('[data-reviews-star-input]', root);

      if (!form) return;

      buildStarInput();
      on(form, 'submit', handleSubmit);

      const textarea = $('textarea[name="reviewQuote"]', form);
      on(textarea, 'input', function () {
        if (charEl) charEl.textContent = String(textarea.value.length);
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     BOOTSTRAP
     ========================================================================== */
  async function bootstrap() {
    const root = $(CONFIG.rootSelector);
    if (!root) return;

    try {
      Feed.init();
      SubmitForm.init();
      Clock.init();

      state.reviews = Store.merge();
      state.signature = state.reviews.map((r) => r.id).join('|');
      Aggregate.render();
      Feed.render();
      Feed.play();

      // Live refresh loop
      window.setInterval(async function () {
        const fresh = await Store.sync();
        if (!fresh.length) return;
        const signature = fresh.map((r) => r.id).join('|');
        if (signature === state.signature) return;
        state.signature = signature;
        state.reviews = fresh;
        Aggregate.render();
        Feed.render();
        Feed.play();
      }, CONFIG.refreshMs);

      // Cross-tab instant sync
      on(window, 'storage', function (e) {
        if (e.key !== CONFIG.storageKey) return;
        state.reviews = Store.merge();
        Aggregate.render();
        Feed.render();
        Feed.play();
      });

      // Refresh relative timestamps when returning to the tab
      on(document, 'visibilitychange', function () {
        if (!document.hidden) Clock.tick();
      });
    } catch (err) {
      if (window.console && console.warn) {
        console.warn('[Bossy Designs] Reviews init error:', err);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
