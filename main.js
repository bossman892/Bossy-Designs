/* ==========================================================================
   BOSSY DESIGNS — MAIN.JS
   Urban Brutalist Precision — Interaction Engine
   Location: Nairobi, Kenya [254]
   Version: 2025.1.0
   ========================================================================== */

(function () {
  'use strict';

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

  /* ==========================================================================
     MOBILE NAVIGATION
     ========================================================================== */
  const MobileNav = (function () {
    let panel    = null;
    let backdrop = null;
    let toggle   = null;
    let closeBtn = null;

    function open() {
      if (!panel || !backdrop) return;
      panel.classList.add('open');
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }

    function close() {
      if (!panel || !backdrop) return;
      panel.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }

    function toggleMenu() {
      if (!panel) return;
      if (panel.classList.contains('open')) {
        close();
      } else {
        open();
      }
    }

    function init() {
      panel    = $('#mobileNavPanel');
      backdrop = $('#mobileNavBackdrop');
      toggle   = $('#mobileMenuToggle');
      closeBtn = $('#mobileNavClose');

      if (!panel) return; // No mobile nav present on this page

      on(toggle, 'click', toggleMenu);
      on(closeBtn, 'click', close);
      on(backdrop, 'click', close);

      // Close on Escape key
      on(document, 'keydown', function (e) {
        if (e.key === 'Escape' && panel.classList.contains('open')) {
          close();
        }
      });

      // Close when any nav link is clicked
      $$('a', panel).forEach(function (link) {
        on(link, 'click', close);
      });

      // Close on resize to desktop
      let resizeTimer;
      on(window, 'resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          if (window.innerWidth >= 768) {
            close();
          }
        }, 150);
      });
    }

    return { init: init, open: open, close: close };
  })();

  /* ==========================================================================
     SMOOTH SCROLL FOR ANCHOR LINKS
     ========================================================================== */
  const SmoothScroll = (function () {
    function init() {
      $$('a[href^="#"]').forEach(function (anchor) {
        on(anchor, 'click', function (e) {
          const href = anchor.getAttribute('href');
          if (!href || href === '#' || href.length < 2) return;

          const target = document.getElementById(href.substring(1));
          if (!target) return;

          e.preventDefault();

          const headerOffset = 80;
          const elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
          const offsetPosition = elementPosition - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });

          // Close mobile nav if open
          MobileNav.close();

          // Update URL hash without jumping
          if (history.pushState) {
            history.pushState(null, '', href);
          } else {
            window.location.hash = href;
          }
        });
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     PILL TOGGLE GROUP (Capability Selector)
     ========================================================================== */
  const PillToggle = (function () {
    function init() {
      $$('.pill-toggle-group').forEach(function (group) {
        const pills = $$('.toggle-pill', group);
        if (!pills.length) return;

        pills.forEach(function (pill) {
          on(pill, 'click', function () {
            pills.forEach(function (p) {
              p.classList.remove('active-whatsapp', 'active-primary');
            });

            const variant = pill.getAttribute('data-active-class');
            if (variant) {
              pill.classList.add(variant);
            } else {
              pill.classList.add('active-primary');
            }

            // Update hidden radio input if present
            const value = pill.getAttribute('data-value') || pill.textContent.trim();
            const radioName = group.getAttribute('data-radio-name');
            if (radioName) {
              const radio = document.querySelector(
                'input[name="' + radioName + '"][value="' + value + '"]'
              );
              if (radio) radio.checked = true;
            }
          });
        });
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     WHATSAPP DISPATCH
     ========================================================================== */
  const WhatsAppDispatch = (function () {
    const PHONE = '254796625193';

    function buildUrl(service, name) {
      const message =
        'Hi Sam, my name is ' + name + '. ' +
        "I'm interested in " + service + ' ' +
        'for my project with Bossy Designs.';

      return (
        'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(message)
      );
    }

    function init() {
      const form = $('#whatsappForm');
      if (!form) return;

      on(form, 'submit', function (e) {
        e.preventDefault();

        const selectedRadio = form.querySelector('input[name="service"]:checked');
        const service = selectedRadio ? selectedRadio.value : 'Web Design';

        const nameInput = $('#clientName', form);
        const name =
          nameInput && nameInput.value.trim() !== ''
            ? nameInput.value.trim()
            : 'a prospective client';

        const url = buildUrl(service, name);
        window.open(url, '_blank', 'noopener,noreferrer');

        // Optional: reset the name input
        if (nameInput) nameInput.value = '';
      });

      // Also handle the "OPEN APP" style links with data-dispatch="whatsapp"
      $$('[data-dispatch="whatsapp"]').forEach(function (el) {
        on(el, 'click', function (e) {
          e.preventDefault();
          const nameInput = $('#clientName');
          const name =
            nameInput && nameInput.value.trim() !== ''
              ? nameInput.value.trim()
              : 'a prospective client';
          window.open(buildUrl('Web Design', name), '_blank', 'noopener,noreferrer');
        });
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     EMAIL DISPATCH
     ========================================================================== */
  const EmailDispatch = (function () {
    const EMAIL = 'kirugasamuel2@gmail.com';

    function buildMailto(service, name) {
      const subject =
        name && name !== 'a prospective client'
          ? 'Project Inquiry: ' + service + ' - ' + name
          : 'Project Inquiry: ' + service + ' - Bossy Designs';

      const body =
        'Hi Sam,\n\n' +
        'My name is ' + name + '. ' +
        "I'm reaching out regarding " + service + ' services ' +
        'for my project with Bossy Designs.\n\n' +
        'Looking forward to connecting.';

      return (
        'mailto:' + EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body)
      );
    }

    function init() {
      const form = $('#emailForm');
      if (!form) return;

      on(form, 'submit', function (e) {
        e.preventDefault();

        const selectedRadio = form.querySelector('input[name="emailService"]:checked');
        const service = selectedRadio ? selectedRadio.value : 'Web Design';

        const nameInput = $('#emailClientName', form);
        const name =
          nameInput && nameInput.value.trim() !== ''
            ? nameInput.value.trim()
            : 'a prospective client';

        window.location.href = buildMailto(service, name);

        // Optional: reset the name input
        if (nameInput) nameInput.value = '';
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     FAQ ACCORDION (single-open behavior, optional)
     ========================================================================== */
  const FAQAccordion = (function () {
    function init() {
      const items = $$('.faq-item');
      if (!items.length) return;

      items.forEach(function (item) {
        on(item, 'toggle', function () {
          // If opening this one, close the others
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
     TICKER MARQUEE (auto-duplicate content for seamless loop)
     ========================================================================== */
  const Ticker = (function () {
    function init() {
      $$('.ticker-bar').forEach(function (bar) {
        const track = bar.querySelector('.ticker-track');
        if (!track) return;

        // Duplicate content if it exists
        const content = track.innerHTML;
        if (content && track.children.length < 4) {
          track.innerHTML = content + content;
        }
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     CURRENT YEAR IN FOOTER
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
     ACTIVE NAV LINK (based on current path)
     ========================================================================== */
  const ActiveNav = (function () {
    function init() {
      let path = window.location.pathname.split('/').pop() || 'index.html';
      if (path === '') path = 'index.html';

      $$('.nav-links a, .mobile-nav-panel nav a').forEach(function (link) {
        const href = link.getAttribute('href');
        if (!href) return;

        const hrefNoHash = href.split('#')[0];
        const cleanHref = hrefNoHash === '' ? 'index.html' : hrefNoHash.split('/').pop() || 'index.html';
        const isHomeLink = href.startsWith('#') && (path === 'index.html' || path === '');

        if (cleanHref === path || isHomeLink) {
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
     EXTERNAL LINKS — open in new tab safely
     ========================================================================== */
  const ExternalLinks = (function () {
    function init() {
      $$('a[href^="http"]').forEach(function (link) {
        // Skip if same-origin
        try {
          const url = new URL(link.href, window.location.origin);
          if (url.origin === window.location.origin) return;
        } catch (e) {
          return;
        }

        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });
    }

    return { init: init };
  })();

  /* ==========================================================================
     LAZY LOAD IMAGES (native fallback)
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
     FORM VALIDATION HELPERS
     ========================================================================== */
  const FormHelpers = (function () {
    function isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function showStatus(el, message, isError) {
      if (!el) return;
      el.textContent = message;
      el.classList.remove('hidden');
      el.style.display = 'block';

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

    return { isValidEmail: isValidEmail, showStatus: showStatus };
  })();

  /* ==========================================================================
     GENERIC CONTACT FORM (if a #contactForm exists)
     ========================================================================== */
  const ContactForm = (function () {
    function init() {
      const form = $('#contactForm');
      if (!form) return;

      const statusEl = $('#formStatus');

      on(form, 'submit', function (e) {
        e.preventDefault();

        const nameEl    = $('#name', form);
        const emailEl   = $('#email', form);
        const messageEl = $('#message', form);
        const consentEl = $('#consent', form);

        const name    = nameEl    ? nameEl.value.trim()    : '';
        const email   = emailEl   ? emailEl.value.trim()   : '';
        const message = messageEl ? messageEl.value.trim() : '';
        const consent = consentEl ? consentEl.checked      : false;

        if (!name || !email || !message || !consent) {
          FormHelpers.showStatus(
            statusEl,
            '// ERROR: Please fill all required fields and accept consent.',
            true
          );
          return;
        }

        if (!FormHelpers.isValidEmail(email)) {
          FormHelpers.showStatus(
            statusEl,
            '// ERROR: Please enter a valid email address.',
            true
          );
          return;
        }

        FormHelpers.showStatus(
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
     BOOTSTRAP
     ========================================================================== */
  function bootstrap() {
    try {
      MobileNav.init();
      SmoothScroll.init();
      PillToggle.init();
      WhatsAppDispatch.init();
      EmailDispatch.init();
      FAQAccordion.init();
      Ticker.init();
      YearStamp.init();
      ActiveNav.init();
      ExternalLinks.init();
      LazyImages.init();
      ContactForm.init();
    } catch (err) {
      // Fail silently in production; log in development
      if (window.console && console.warn) {
        console.warn('[Bossy Designs] Init error:', err);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();