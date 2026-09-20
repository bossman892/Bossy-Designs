/* ==========================================================================
   BOSSY DESIGNS — CONTACT.JS
   Direct Dispatch Protocol — Interaction Engine
   Location: Nairobi, Kenya [254]
   Version: 2025.1.0
   ========================================================================== */

(function () {
  'use strict';

  /* ==========================================================================
     UTILITIES
     ========================================================================== */
  const $ = function (selector, context) {
    return (context || document).querySelector(selector);
  };

  const $$ = function (selector, context) {
    return Array.prototype.slice.call(
      (context || document).querySelectorAll(selector)
    );
  };

  const on = function (el, event, handler, options) {
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener(event, handler, options || false);
    }
  };

  const off = function (el, event, handler) {
    if (el && typeof el.removeEventListener === 'function') {
      el.removeEventListener(event, handler);
    }
  };

  /* ==========================================================================
     CONFIG
     ========================================================================== */
  const CONFIG = {
    whatsappNumber: '254796625193',
    emailAddress: 'kirugasamuel2@gmail.com',
    defaultService: 'Web Design',
    defaultName: 'a prospective client',
    mobileBreakpoint: 768,
    headerOffset: 80
  };

  /* ==========================================================================
     MOBILE NAVIGATION
     ========================================================================== */
  const MobileNav = (function () {
    let panel = null;
    let backdrop = null;
    let toggleBtn = null;
    let closeBtn = null;
    let isOpen = false;

    function open() {
      if (!panel || !backdrop) return;
      panel.classList.add('open');
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
      isOpen = true;
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    }

    function close() {
      if (!panel || !backdrop) return;
      panel.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
      isOpen = false;
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    }

    function toggle() {
      if (isOpen) {
        close();
      } else {
        open();
      }
    }

    function handleKeydown(e) {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    }

    function handleResize() {
      if (window.innerWidth >= CONFIG.mobileBreakpoint && isOpen) {
        close();
      }
    }

    function init() {
      panel = $('#mobileNavPanel');
      backdrop = $('#mobileNavBackdrop');
      toggleBtn = $('#mobileMenuToggle');
      closeBtn = $('#mobileNavClose');

      if (!panel) return;

      on(toggleBtn, 'click', toggle);
      on(closeBtn, 'click', close);
      on(backdrop, 'click', close);
      on(document, 'keydown', handleKeydown);

      // Debounced resize handler
      let resizeTimer;
      on(window, 'resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(handleResize, 150);
      });

      // Auto-close when a nav link is clicked
      $$('a', panel).forEach(function (link) {
        on(link, 'click', function () {
          // Small delay allows the anchor to navigate first
          setTimeout(close, 50);
        });
      });
    }

    return {
      init: init,
      open: open,
      close: close,
      toggle: toggle
    };
  })();

  /* ==========================================================================
     SMOOTH SCROLL FOR ANCHOR LINKS
     ========================================================================== */
  const SmoothScroll = (function () {
    function scrollToTarget(target) {
      if (!target) return;

      const elementPosition =
        target.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - CONFIG.headerOffset;

      if ('scrollBehavior' in document.documentElement.style) {
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      } else {
        // Fallback for older browsers
        window.scrollTo(0, offsetPosition);
      }
    }

    function init() {
      $$('a[href^="#"]').forEach(function (anchor) {
        on(anchor, 'click', function (e) {
          const href = anchor.getAttribute('href');
          if (!href || href === '#' || href.length < 2) return;

          let target;
          try {
            target = document.getElementById(href.substring(1));
          } catch (err) {
            return;
          }

          if (!target) return;

          e.preventDefault();
          scrollToTarget(target);
          MobileNav.close();

          // Update URL hash without triggering jump
          if (history && history.pushState) {
            history.pushState(null, '', href);
          }
        });
      });
    }

    return { init: init, scrollToTarget: scrollToTarget };
  })();

  /* ==========================================================================
     PILL TOGGLE GROUPS (Capability Selector)
     ========================================================================== */
  const PillToggle = (function () {
    function setActive(group, activePill, variantClass) {
      const pills = $$('.toggle-pill', group);
      pills.forEach(function (pill) {
        pill.classList.remove('active-whatsapp', 'active-primary');
        pill.setAttribute('aria-pressed', 'false');
      });
      activePill.classList.add(variantClass);
      activePill.setAttribute('aria-pressed', 'true');
    }

    function init() {
      $$('.pill-toggle-group').forEach(function (group) {
        const pills = $$('.toggle-pill', group);
        if (!pills.length) return;

        pills.forEach(function (pill) {
          on(pill, 'click', function (e) {
            e.preventDefault();
            const variantClass =
              pill.getAttribute('data-active-class') ||
              (group.getAttribute('data-variant') === 'whatsapp'
                ? 'active-whatsapp'
                : 'active-primary');

            setActive(group, pill, variantClass);
          });

          // Initialize aria-pressed
          if (!pill.hasAttribute('aria-pressed')) {
            pill.setAttribute('aria-pressed', 'false');
          }
        });

        // Mark initial active state
        pills.forEach(function (pill) {
          if (
            pill.classList.contains('active-whatsapp') ||
            pill.classList.contains('active-primary')
          ) {
            pill.setAttribute('aria-pressed', 'true');
          }
        });
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     WHATSAPP DISPATCH
     ========================================================================== */
  const WhatsAppDispatch = (function () {
    function buildUrl(service, name) {
      const message =
        'Hi Sam, my name is ' + name + '. ' +
        "I'm interested in " + service + ' ' +
        'for my project with Bossy Designs.';

      return (
        'https://wa.me/' +
        CONFIG.whatsappNumber +
        '?text=' +
        encodeURIComponent(message)
      );
    }

    function getServiceValue(form) {
      const radio = form.querySelector('input[name="service"]:checked');
      if (radio) return radio.value;

      const activePill = form.querySelector(
        '.toggle-pill.active-whatsapp, .toggle-pill.active-primary'
      );
      if (activePill) {
        const value = activePill.getAttribute('data-value');
        if (value) return value;
        return activePill.textContent.trim();
      }

      return CONFIG.defaultService;
    }

    function getNameValue(form) {
      const input = $('#clientName', form) || form.querySelector('input[type="text"]');
      if (!input) return CONFIG.defaultName;
      const val = input.value.trim();
      return val !== '' ? val : CONFIG.defaultName;
    }

    function dispatch(url) {
      try {
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (!win) {
          // Popup blocked — fallback to same-tab navigation
          window.location.href = url;
        }
      } catch (err) {
        window.location.href = url;
      }
    }

    function init() {
      const form = $('#whatsappForm');
      if (!form) return;

      on(form, 'submit', function (e) {
        e.preventDefault();
        const service = getServiceValue(form);
        const name = getNameValue(form);
        const url = buildUrl(service, name);
        dispatch(url);

        const input = $('#clientName', form);
        if (input) input.value = '';
      });
    }

    return { init: init, buildUrl: buildUrl };
  })();

  /* ==========================================================================
     EMAIL DISPATCH
     ========================================================================== */
  const EmailDispatch = (function () {
    function buildMailto(service, name) {
      const subject =
        name && name !== CONFIG.defaultName
          ? 'Project Inquiry: ' + service + ' - ' + name
          : 'Project Inquiry: ' + service + ' - Bossy Designs';

      const body =
        'Hi Sam,\n\n' +
        'My name is ' + name + '. ' +
        "I'm reaching out regarding " + service + ' services ' +
        'for my project with Bossy Designs.\n\n' +
        'Looking forward to connecting.';

      return (
        'mailto:' +
        CONFIG.emailAddress +
        '?subject=' +
        encodeURIComponent(subject) +
        '&body=' +
        encodeURIComponent(body)
      );
    }

    function getServiceValue(form) {
      const radio = form.querySelector('input[name="emailService"]:checked');
      if (radio) return radio.value;

      const activePill = form.querySelector(
        '.toggle-pill.active-whatsapp, .toggle-pill.active-primary'
      );
      if (activePill) {
        const value = activePill.getAttribute('data-value');
        if (value) return value;
        return activePill.textContent.trim();
      }

      return CONFIG.defaultService;
    }

    function getNameValue(form) {
      const input =
        $('#emailClientName', form) || form.querySelector('input[type="text"]');
      if (!input) return CONFIG.defaultName;
      const val = input.value.trim();
      return val !== '' ? val : CONFIG.defaultName;
    }

    function init() {
      const form = $('#emailForm');
      if (!form) return;

      on(form, 'submit', function (e) {
        e.preventDefault();
        const service = getServiceValue(form);
        const name = getNameValue(form);
        const url = buildMailto(service, name);

        try {
          window.location.href = url;
        } catch (err) {
          // Fallback
          window.location.assign(url);
        }

        const input = $('#emailClientName', form);
        if (input) input.value = '';
      });
    }

    return { init: init, buildMailto: buildMailto };
  })();

  /* ==========================================================================
     EMAIL VALIDATION HELPER
     ========================================================================== */
  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ==========================================================================
     GENERIC CONTACT FORM (optional — for pages with a full form)
     ========================================================================== */
  const ContactForm = (function () {
    function showStatus(el, message, isError) {
      if (!el) return;
      el.textContent = message;
      el.classList.remove('hidden');
      el.style.display = 'block';
      el.style.padding = '0.75rem 1rem';
      el.style.fontFamily = "'JetBrains Mono', monospace";
      el.style.fontSize = '0.8rem';
      el.style.letterSpacing = '0.06em';
      el.style.textTransform = 'uppercase';
      el.style.border = '1px solid';

      if (isError) {
        el.style.background = 'rgba(147, 0, 10, 0.15)';
        el.style.color = '#ffb4ab';
        el.style.borderColor = '#93000a';
      } else {
        el.style.background = 'rgba(255, 127, 28, 0.1)';
        el.style.color = '#ff7a00';
        el.style.borderColor = '#ff7a00';
      }
    }

    function init() {
      const form = $('#contactForm');
      if (!form) return;

      const statusEl = $('#formStatus');

      on(form, 'submit', function (e) {
        e.preventDefault();

        const nameEl = $('#name', form);
        const emailEl = $('#email', form);
        const messageEl = $('#message', form);
        const consentEl = $('#consent', form);

        const name = nameEl ? nameEl.value.trim() : '';
        const email = emailEl ? emailEl.value.trim() : '';
        const message = messageEl ? messageEl.value.trim() : '';
        const consent = consentEl ? consentEl.checked : false;

        if (!name || !email || !message || !consent) {
          showStatus(
            statusEl,
            '// ERROR: Please fill all required fields and accept consent.',
            true
          );
          return;
        }

        if (!isValidEmail(email)) {
          showStatus(
            statusEl,
            '// ERROR: Please enter a valid email address.',
            true
          );
          return;
        }

        showStatus(
          statusEl,
          '// MESSAGE_SENT: Thanks ' + name + ' — we will reply within 24h.',
          false
        );

        form.reset();
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     FAQ ACCORDION (single-open behaviour)
     ========================================================================== */
  const FAQAccordion = (function () {
    function init() {
      const items = $$('.faq-item');
      if (!items.length) return;

      items.forEach(function (item) {
        on(item, 'toggle', function () {
          if (item.open) {
            items.forEach(function (other) {
              if (other !== item && other.open) {
                other.open = false;
              }
            });
          }
        });
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     ACTIVE NAV LINK (based on current path)
     ========================================================================== */
  const ActiveNav = (function () {
    function normalize(href) {
      if (!href) return '';
      const clean = href.split('#')[0].split('?')[0];
      const parts = clean.split('/');
      return parts[parts.length - 1] || 'index.html';
    }

    function init() {
      let path = window.location.pathname.split('/').pop() || 'index.html';
      if (path === '') path = 'index.html';

      $$('.nav-links a, .mobile-nav-panel nav a').forEach(function (link) {
        const href = link.getAttribute('href');
        if (!href) return;

        const target = normalize(href);
        if (target === path) {
          link.classList.add('active');
          link.setAttribute('aria-current', 'page');
        } else {
          link.classList.remove('active');
          link.removeAttribute('aria-current');
        }
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     EXTERNAL LINKS — auto target + rel
     ========================================================================== */
  const ExternalLinks = (function () {
    function init() {
      $$('a[href^="http"]').forEach(function (link) {
        try {
          const url = new URL(link.href, window.location.origin);
          if (url.origin === window.location.origin) return;

          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        } catch (err) {
          // ignore malformed URLs
        }
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     LAZY IMAGES (native fallback)
     ========================================================================== */
  const LazyImages = (function () {
    function init() {
      if (!('loading' in HTMLImageElement.prototype)) return;

      $$('img:not([loading])').forEach(function (img) {
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     CURRENT YEAR STAMP
     ========================================================================== */
  const YearStamp = (function () {
    function init() {
      const els = $$('[data-current-year]');
      const year = new Date().getFullYear();
      els.forEach(function (el) {
        el.textContent = year;
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     TICKER MARQUEE (auto-duplicate for smooth loop)
     ========================================================================== */
  const Ticker = (function () {
    function init() {
      const bar = $('.ticker-bar');
      if (!bar) return;

      const track = bar.querySelector('.ticker-track');
      if (!track) return;

      const content = track.innerHTML;
      if (content && track.children.length < 4) {
        track.innerHTML = content + content;
      }
    }

    return { init: init };
  })();

  /* ==========================================================================
     COPY-TO-CLIPBOARD UTILITY (click-to-copy phone / email)
     ========================================================================== */
  const CopyToClipboard = (function () {
    function copy(text) {
      return new Promise(function (resolve, reject) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(resolve).catch(reject);
        } else {
          try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      });
    }

    function init() {
      $$('[data-copy]').forEach(function (el) {
        on(el, 'click', function (e) {
          e.preventDefault();
          const text = el.getAttribute('data-copy');
          if (!text) return;

          copy(text).then(function () {
            const original = el.textContent;
            el.textContent = '// COPIED';
            setTimeout(function () {
              el.textContent = original;
            }, 1200);
          }).catch(function () {
            // Silent fail
          });
        });
      });
    }

    return { init: init, copy: copy };
  })();

  /* ==========================================================================
     BOOTSTRAP
     ========================================================================== */
  function bootstrap() {
    try {
      MobileNav.init();
      SmoothScroll.init();
      PillToggle.init();
      WhatsAppDispatch.init();
      EmailDispatch.init();
      ContactForm.init();
      FAQAccordion.init();
      ActiveNav.init();
      ExternalLinks.init();
      LazyImages.init();
      YearStamp.init();
      Ticker.init();
      CopyToClipboard.init();
    } catch (err) {
      if (window.console && console.warn) {
        console.warn('[Bossy Designs — Contact] Init error:', err);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  /* ==========================================================================
     PUBLIC API (window.BossyContact)
     ========================================================================== */
  window.BossyContact = {
    version: '2025.1.0',
    config: CONFIG,
    openMobileNav: MobileNav.open,
    closeMobileNav: MobileNav.close,
    toggleMobileNav: MobileNav.toggle,
    scrollTo: SmoothScroll.scrollToTarget,
    whatsapp: WhatsAppDispatch.buildUrl,
    email: EmailDispatch.buildMailto,
    copy: CopyToClipboard.copy
  };

})();