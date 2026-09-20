/* ==========================================================================
 * BOSSY DESIGNS — TELEMETRY & CLIENT CONVERSION ANALYTICS
 * File: analytics.js
 * Location: Nairobi, Kenya [254]
 * Studio Founder: Sam
 * Version: 2025.1.0
 * Description: Lightweight, privacy-first event tracking & client telemetry
 * ========================================================================== */

(function () {
  'use strict';

  // ==========================================================================
  // ANALYTICS CONFIGURATION
  // ==========================================================================
  const CONFIG = {
    appName: 'Bossy Designs',
    version: '2025.1.0',
    studioLocation: 'Nairobi, Kenya',

    // Set to true to print telemetry events to the browser console
    debugMode:
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '',

    // Optional endpoints / IDs (automatically forwarded if detected)
    gaMeasurementId: null, // e.g. 'G-XXXXXXXXXX'
    customEndpoint: null,  // e.g. '/api/telemetry'

    // Scroll milestone thresholds
    scrollMilestones: [25, 50, 75, 100],

    // Session heartbeat interval (ms) — 0 to disable
    heartbeatInterval: 0,

    // Maximum number of events to buffer in memory
    maxBufferSize: 50
  };

  // ==========================================================================
  // TELEMETRY SESSION STATE
  // ==========================================================================
  const session = {
    sessionId: 'session_' + Math.random().toString(36).substring(2, 11),
    startTime: Date.now(),
    maxScrollDepth: 0,
    recordedScrollMilestones: [],
    eventBuffer: [],
    pageViews: 1,
    isActive: true
  };

  // ==========================================================================
  // SAFE UTILITIES
  // ==========================================================================
  function safeString(value) {
    if (value === null || value === undefined) return '';
    try {
      return String(value);
    } catch (err) {
      return '';
    }
  }

  function safeTrim(value) {
    return safeString(value).trim();
  }

  function safeNow() {
    try {
      return new Date().toISOString();
    } catch (err) {
      return '';
    }
  }

  function getScreenResolution() {
    try {
      return (
        (window.innerWidth || 0) +
        'x' +
        (window.innerHeight || 0)
      );
    } catch (err) {
      return 'unknown';
    }
  }

  function getSafeHostname(url) {
    try {
      return new URL(url, window.location.origin).hostname;
    } catch (err) {
      return '';
    }
  }

  function isSameOrigin(url) {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch (err) {
      return true;
    }
  }

  function isExternalLink(url) {
    if (!url) return false;
    if (url.indexOf('http') !== 0) return false;
    return !isSameOrigin(url);
  }

  // ==========================================================================
  // CORE DISPATCH ENGINE
  // Sends events to GA4, Plausible, custom endpoint, or Console
  // ==========================================================================
  function trackEvent(eventName, properties) {
    if (!eventName) return;

    const props = properties || {};

    const payload = {
      event: eventName,
      timestamp: safeNow(),
      session_id: session.sessionId,
      page_path: window.location.pathname || '/',
      page_title: document.title || '',
      screen_resolution: getScreenResolution(),
      user_agent: navigator.userAgent || '',
      referrer: document.referrer || 'direct',
      language: navigator.language || 'en'
    };

    // Merge custom properties (never allow them to overwrite core fields)
    for (const key in props) {
      if (Object.prototype.hasOwnProperty.call(props, key)) {
        if (!Object.prototype.hasOwnProperty.call(payload, key) || key.indexOf('custom_') === 0) {
          payload[key] = props[key];
        } else {
          // Preserve core fields by prefixing custom
          payload['custom_' + key] = props[key];
        }
      }
    }

    // Buffer the event in memory
    try {
      session.eventBuffer.push(payload);
      if (session.eventBuffer.length > CONFIG.maxBufferSize) {
        session.eventBuffer.shift();
      }
    } catch (err) {
      // Buffer overflow protection
    }

    // 1. Terminal Console Logging (Urban Brutalist styling)
    if (CONFIG.debugMode && window.console && console.log) {
      try {
        console.log(
          '%c// BOSSY_TELEMETRY :: ' + safeString(eventName).toUpperCase(),
          'color: #ff7a00; font-weight: bold; background: #131313; padding: 2px 6px; border-left: 3px solid #c8102e;',
          payload
        );
      } catch (err) {
        // Console may be unavailable
      }
    }

    // 2. Google Analytics 4 (gtag) forwarding if present
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, props);
      }
    } catch (err) {
      // Silent fail — never break the page
    }

    // 3. Plausible Analytics forwarding if present
    try {
      if (typeof window.plausible === 'function') {
        window.plausible(eventName, { props: props });
      }
    } catch (err) {
      // Silent fail
    }

    // 4. Custom REST / Beacon dispatch if endpoint configured
    try {
      if (CONFIG.customEndpoint && navigator.sendBeacon) {
        navigator.sendBeacon(
          CONFIG.customEndpoint,
          JSON.stringify(payload)
        );
      }
    } catch (err) {
      // Silent fail
    }
  }

  // ==========================================================================
  // 1. PAGE VIEW & INITIAL TELEMETRY
  // ==========================================================================
  function trackPageView() {
    trackEvent('page_view', {
      referrer: document.referrer || 'direct',
      screen_resolution: getScreenResolution(),
      language: navigator.language || 'en',
      viewport_width: window.innerWidth || 0,
      viewport_height: window.innerHeight || 0,
      is_mobile: isMobileDevice()
    });
  }

  function isMobileDevice() {
    try {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent || ''
      );
    } catch (err) {
      return false;
    }
  }

  // ==========================================================================
  // 2. HIGH-INTENT CONVERSION TRACKING (WHATSAPP & EMAIL)
  // ==========================================================================
  function getSelectedService(container, selectors) {
    if (!container) return 'WEB DESIGN';
    for (let i = 0; i < selectors.length; i++) {
      const el = container.querySelector(selectors[i]);
      if (el) {
        const dataValue =
          el.getAttribute('data-service-wa') ||
          el.getAttribute('data-service-email') ||
          el.getAttribute('data-value');
        if (dataValue) return safeTrim(dataValue).toUpperCase();
        return safeTrim(el.innerText).toUpperCase() || 'WEB DESIGN';
      }
    }
    return 'WEB DESIGN';
  }

  function handleConversionClick(e) {
    if (!e || !e.target) return;

    let target;
    try {
      target = e.target;
      // Ensure target has closest() — text nodes don't
      if (!target.closest) {
        target = target.parentElement;
      }
      if (!target || !target.closest) return;
    } catch (err) {
      return;
    }

    // A. WhatsApp Inquiries
    try {
      const waBtn = target.closest(
        '#wa-send-btn, #wa-submit, .btn-whatsapp, [data-dispatch="whatsapp"] button, [data-dispatch="whatsapp"]'
      );
      if (waBtn) {
        const waContainer =
          document.querySelector('#whatsapp-card') ||
          document.querySelector('#whatsappForm') ||
          document;

        const selectedService = getSelectedService(waContainer, [
          '.active-whatsapp',
          '[data-service-wa].active',
          '.toggle-pill.active-whatsapp',
          'input[name="service"]:checked'
        ]);

        trackEvent('conversion_whatsapp_dispatch', {
          service_category: selectedService,
          target_destination: 'https://wa.me/254796625193',
          lead_type: 'Direct Client Dispatch',
          is_mobile: isMobileDevice()
        });
      }
    } catch (err) {
      // Silent fail
    }

    // B. Email Mailto Inquiries
    try {
      const emailBtn = target.closest(
        '#email-send-btn, #email-submit, .btn-email, [data-dispatch="email"] button, [data-dispatch="email"]'
      );
      if (emailBtn) {
        const emailContainer =
          document.querySelector('#email-card') ||
          document.querySelector('#emailForm') ||
          document;

        const selectedService = getSelectedService(emailContainer, [
          '.active-primary',
          '[data-service-email].active',
          '.toggle-pill.active-primary',
          'input[name="emailService"]:checked'
        ]);

        trackEvent('conversion_email_dispatch', {
          service_category: selectedService,
          target_recipient: 'kirugasamuel2@gmail.com',
          lead_type: 'Direct Client Mailto',
          is_mobile: isMobileDevice()
        });
      }
    } catch (err) {
      // Silent fail
    }

    // C. Clipboard Quick-Copy Actions
    try {
      const copyTrigger = target.closest('[data-copy]');
      if (copyTrigger) {
        const copiedValue =
          copyTrigger.getAttribute('data-copy') ||
          safeTrim(copyTrigger.innerText);
        trackEvent('engagement_clipboard_copy', {
          copied_field: copiedValue.indexOf('@') > -1 ? 'Email' : 'Phone/WhatsApp',
          value: copiedValue
        });
      }
    } catch (err) {
      // Silent fail
    }

    // D. External Portfolio Case Study Outbound Clicks
    try {
      const externalLink = target.closest('a[href^="http"]');
      if (externalLink) {
        const url = externalLink.getAttribute('href');
        if (isExternalLink(url)) {
          const hostname = getSafeHostname(url);
          trackEvent('outbound_click', {
            target_url: url,
            target_domain: hostname,
            link_text: safeTrim(externalLink.innerText) || 'icon_link'
          });
        }
      }
    } catch (err) {
      // Silent fail
    }
  }

  function initConversionTracking() {
    document.addEventListener('click', handleConversionClick, false);
  }

  // ==========================================================================
  // 3. SERVICE SELECTION TOGGLE ENGAGEMENT
  // ==========================================================================
  function handleToggleClick(e) {
    if (!e || !e.target) return;

    let target;
    try {
      target = e.target.closest
        ? e.target.closest(
            '[data-service-wa], [data-service-email], .wa-pill, .email-pill, .toggle-pill'
          )
        : null;
    } catch (err) {
      return;
    }

    if (!target) return;

    try {
      const service =
        target.getAttribute('data-service-wa') ||
        target.getAttribute('data-service-email') ||
        target.getAttribute('data-value') ||
        safeTrim(target.innerText);

      let platform = 'Unknown';
      if (target.closest('#whatsapp-card') || target.closest('#whatsappForm')) {
        platform = 'WhatsApp';
      } else if (target.closest('#email-card') || target.closest('#emailForm')) {
        platform = 'Email';
      }

      trackEvent('capability_toggle_click', {
        service: safeString(service).toUpperCase(),
        dispatch_channel: platform
      });
    } catch (err) {
      // Silent fail
    }
  }

  function initCapabilityToggleTracking() {
    document.addEventListener('click', handleToggleClick, false);
  }

  // ==========================================================================
  // 4. FAQ INTERACTION TRACKING
  // ==========================================================================
  function handleFAQClick(e) {
    if (!e || !e.target) return;

    let faqHeader;
    try {
      faqHeader = e.target.closest
        ? e.target.closest(
            '.faq-item summary, .faq-header, [data-faq] button, .faq-question'
          )
        : null;
    } catch (err) {
      return;
    }

    if (!faqHeader) return;

    try {
      const questionText = safeTrim(faqHeader.innerText)
        .replace(/[+\u2013\u2014]/g, '')
        .trim();

      trackEvent('faq_accordion_toggle', {
        question: questionText || 'unknown_question'
      });
    } catch (err) {
      // Silent fail
    }
  }

  function initFAQTracking() {
    document.addEventListener('click', handleFAQClick, false);
  }

  // ==========================================================================
  // 5. SCROLL DEPTH TELEMETRY (25%, 50%, 75%, 100%)
  // ==========================================================================
  function initScrollDepthTracking() {
    let ticking = false;

    function onScroll() {
      if (ticking) return;

      ticking = true;

      // Use requestAnimationFrame if available, otherwise setTimeout
      const raf =
        window.requestAnimationFrame ||
        function (cb) {
          return setTimeout(cb, 16);
        };

      raf(function () {
        try {
          const docHeight =
            document.documentElement.scrollHeight - window.innerHeight;

          if (docHeight <= 0) {
            ticking = false;
            return;
          }

          const scrollPercentage = Math.min(
            100,
            Math.round((window.scrollY / docHeight) * 100)
          );

          if (scrollPercentage > session.maxScrollDepth) {
            session.maxScrollDepth = scrollPercentage;
          }

          const milestones = CONFIG.scrollMilestones;

          for (let i = 0; i < milestones.length; i++) {
            const milestone = milestones[i];

            if (
              scrollPercentage >= milestone &&
              session.recordedScrollMilestones.indexOf(milestone) === -1
            ) {
              session.recordedScrollMilestones.push(milestone);
              trackEvent('scroll_milestone', {
                depth_percent: milestone
              });
            }
          }
        } catch (err) {
          // Silent fail
        }

        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ==========================================================================
  // 6. ENGAGEMENT TIME & BOUNCE PROTECTION
  // ==========================================================================
  function initEngagementDuration() {
    function recordDuration() {
      try {
        const secondsSpent = Math.round(
          (Date.now() - session.startTime) / 1000
        );

        trackEvent('session_engagement_duration', {
          duration_seconds: secondsSpent,
          max_scroll_depth: session.maxScrollDepth,
          events_recorded: session.eventBuffer.length
        });
      } catch (err) {
        // Silent fail
      }
    }

    window.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        session.isActive = false;
        recordDuration();
      } else {
        session.isActive = true;
      }
    });

    // Fallback for browsers without visibilitychange
    window.addEventListener('beforeunload', recordDuration);
    window.addEventListener('pagehide', recordDuration);

    // Optional heartbeat
    if (CONFIG.heartbeatInterval > 0) {
      setInterval(function () {
        if (session.isActive && document.visibilityState !== 'hidden') {
          const secondsSpent = Math.round(
            (Date.now() - session.startTime) / 1000
          );
          trackEvent('session_heartbeat', {
            duration_seconds: secondsSpent,
            max_scroll_depth: session.maxScrollDepth
          });
        }
      }, CONFIG.heartbeatInterval);
    }
  }

  // ==========================================================================
  // 7. SPA / HASH ROUTE CHANGE DETECTION
  // ==========================================================================
  function initRouteChangeTracking() {
    let lastPath = window.location.pathname + window.location.hash;

    function checkRoute() {
      const currentPath = window.location.pathname + window.location.hash;

      if (currentPath !== lastPath) {
        lastPath = currentPath;
        session.pageViews++;
        session.recordedScrollMilestones = [];
        session.maxScrollDepth = 0;

        trackEvent('route_change', {
          new_path: currentPath,
          page_view_number: session.pageViews
        });

        trackPageView();
      }
    }

    // Listen for popstate (back / forward)
    window.addEventListener('popstate', checkRoute);

    // Listen for hashchange
    window.addEventListener('hashchange', checkRoute);

    // Poll for pushState / replaceState changes
    if (window.history && window.history.pushState) {
      const originalPush = window.history.pushState;
      const originalReplace = window.history.replaceState;

      window.history.pushState = function () {
        originalPush.apply(window.history, arguments);
        checkRoute();
      };

      window.history.replaceState = function () {
        originalReplace.apply(window.history, arguments);
        checkRoute();
      };
    }
  }

  // ==========================================================================
  // 8. FORM SUBMISSION TRACKING (generic)
  // ==========================================================================
  function initFormSubmissionTracking() {
    document.addEventListener(
      'submit',
      function (e) {
        if (!e || !e.target) return;

        const form = e.target;

        try {
          let formId = form.getAttribute('id') || form.getAttribute('name') || 'unknown_form';

          // Detect specific known forms
          let formType = 'generic';
          if (form.id === 'whatsappForm') formType = 'whatsapp';
          else if (form.id === 'emailForm') formType = 'email';
          else if (form.id === 'contactForm') formType = 'contact';

          trackEvent('form_submission', {
            form_id: formId,
            form_type: formType
          });
        } catch (err) {
          // Silent fail
        }
      },
      true
    );
  }

  // ==========================================================================
  // 9. PERFORMANCE TIMING (Page Load)
  // ==========================================================================
  function trackPerformanceMetrics() {
    try {
      if (!window.performance || !window.performance.timing) return;

      window.addEventListener('load', function () {
        setTimeout(function () {
          try {
            const timing = window.performance.timing;
            const navStart = timing.navigationStart;

            if (navStart <= 0) return;

            const metrics = {
              dns_lookup_ms: timing.domainLookupEnd - timing.domainLookupStart,
              tcp_connect_ms: timing.connectEnd - timing.connectStart,
              ttfb_ms: timing.responseStart - timing.navigationStart,
              dom_ready_ms: timing.domContentLoadedEventEnd - navStart,
              page_load_ms: timing.loadEventEnd - navStart
            };

            trackEvent('performance_timing', metrics);
          } catch (err) {
            // Silent fail
          }
        }, 0);
      });
    } catch (err) {
      // Silent fail
    }
  }

  // ==========================================================================
  // 10. NAVIGATION LINK TRACKING (internal anchors & routes)
  // ==========================================================================
  function initNavigationTracking() {
    document.addEventListener(
      'click',
      function (e) {
        if (!e || !e.target) return;

        let link;
        try {
          link = e.target.closest ? e.target.closest('a') : null;
        } catch (err) {
          return;
        }

        if (!link) return;

        try {
          const href = link.getAttribute('href');

          if (!href) return;

          // Anchor links (smooth-scroll navigation)
          if (href.indexOf('#') === 0 && href.length > 1) {
            trackEvent('nav_anchor_click', {
              target_section: href.substring(1),
              link_text: safeTrim(link.innerText) || 'icon'
            });
            return;
          }

          // Internal page navigation
          if (
            href.indexOf('http') !== 0 &&
            href.indexOf('//') !== 0 &&
            href.indexOf('mailto:') !== 0 &&
            href.indexOf('tel:') !== 0
          ) {
            trackEvent('nav_internal_click', {
              target_page: href.split('#')[0] || 'index.html',
              link_text: safeTrim(link.innerText) || 'icon',
              is_mobile_nav: !!link.closest('#mobileNavPanel')
            });
          }
        } catch (err) {
          // Silent fail
        }
      },
      false
    );
  }

  // ==========================================================================
  // INITIALIZE ON SCRIPT LOAD
  // ==========================================================================
  function bootstrap() {
    try {
      trackPageView();
      initConversionTracking();
      initCapabilityToggleTracking();
      initFAQTracking();
      initScrollDepthTracking();
      initEngagementDuration();
      initRouteChangeTracking();
      initFormSubmissionTracking();
      trackPerformanceMetrics();
      initNavigationTracking();

      if (CONFIG.debugMode && window.console && console.log) {
        console.log(
          '%c// BOSSY_DESIGNS :: TELEMETRY_ACTIVE [SYS: NAIROBI_DISPATCH]',
          'color: #25d366; font-weight: bold; background: #0e0e0e; padding: 4px 8px; border-left: 3px solid #ff7a00;'
        );
        console.log(
          '%c// SESSION_ID :: ' + session.sessionId,
          'color: #a3a3a3; background: #131313; padding: 2px 6px; font-family: monospace;'
        );
      }
    } catch (err) {
      if (window.console && console.warn) {
        console.warn('[Bossy Analytics] Bootstrap error:', err);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================
  window.BossyAnalytics = {
    version: CONFIG.version,
    config: CONFIG,

    track: trackEvent,

    getSession: function () {
      return {
        sessionId: session.sessionId,
        startTime: session.startTime,
        duration_seconds: Math.round((Date.now() - session.startTime) / 1000),
        maxScrollDepth: session.maxScrollDepth,
        recordedScrollMilestones: session.recordedScrollMilestones.slice(),
        eventCount: session.eventBuffer.length,
        pageViews: session.pageViews,
        isActive: session.isActive
      };
    },

    getEvents: function () {
      return session.eventBuffer.slice();
    },

    clearBuffer: function () {
      session.eventBuffer = [];
    },

    setCustomEndpoint: function (endpoint) {
      CONFIG.customEndpoint = endpoint;
    },

    setDebugMode: function (enabled) {
      CONFIG.debugMode = !!enabled;
    },

    identify: function (traits) {
      trackEvent('user_identify', traits || {});
    },

    page: function (pageName, props) {
      session.pageViews++;
      session.recordedScrollMilestones = [];
      session.maxScrollDepth = 0;
      trackEvent('page', Object.assign({ page_name: pageName }, props || {}));
    }
  };
})();