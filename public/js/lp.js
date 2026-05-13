/**
 * 日本メダカオンライン市場 LP - lp.js
 */
(function () {
  'use strict';

  /* =============================
     Scroll Animation (IntersectionObserver)
     ============================= */
  function initScrollAnimations() {
    var targets = document.querySelectorAll('.anim');
    if (!targets.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* =============================
     Header - scroll shadow + auto-hide
     ============================= */
  function initHeader() {
    var header = document.getElementById('header');
    if (!header) return;

    var lastY = 0;
    var ticking = false;

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          var y = window.scrollY;
          if (y > 60) {
            header.classList.add('is-scrolled');
          } else {
            header.classList.remove('is-scrolled');
          }
          if (y > 400 && y > lastY + 5) {
            header.style.transform = 'translateY(-100%)';
          } else {
            header.style.transform = 'translateY(0)';
          }
          lastY = y;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* =============================
     Lineup horizontal scroll (drag)
     ============================= */
  function initLineupScroll() {
    var track = document.getElementById('lineup-carousel');
    if (!track) return;

    var isDown = false;
    var startX, scrollLeft;

    track.addEventListener('mousedown', function (e) {
      isDown = true;
      track.style.cursor = 'grabbing';
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.parentElement.scrollLeft;
    });
    track.addEventListener('mouseleave', function () { isDown = false; track.style.cursor = ''; });
    track.addEventListener('mouseup', function () { isDown = false; track.style.cursor = ''; });
    track.addEventListener('mousemove', function (e) {
      if (!isDown) return;
      e.preventDefault();
      var x = e.pageX - track.offsetLeft;
      track.parentElement.scrollLeft = scrollLeft - (x - startX);
    });
  }

  /* =============================
     Floating CTA (mobile)
     ============================= */
  function initFloatingCta() {
    var cta = document.getElementById('floating-cta');
    if (!cta) return;

    window.addEventListener('scroll', function () {
      if (window.scrollY > 600) {
        cta.classList.add('visible');
      } else {
        cta.classList.remove('visible');
      }
    }, { passive: true });
  }

  /* =============================
     Hero - decorative drifting dots (image area only)
     ============================= */
  function initHeroDots() {
    var canvas = document.getElementById('hero-dots');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var dots = [];
    var w = 0, h = 0;
    var raf = null;
    var t = 0;
    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.max(30, Math.min(80, Math.round((w * h) / 9000)));
      dots = [];
      for (var i = 0; i < count; i++) {
        var size = Math.random();
        dots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: size < 0.7 ? Math.random() * 1.6 + 0.8
                        : Math.random() * 2.4 + 2.2,
          a: Math.random() * 0.35 + 0.25,
          accent: Math.random() < 0.14,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      t += 0.01;
      for (var k = 0; k < dots.length; k++) {
        var p = dots[k];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        else if (p.y > h + 10) p.y = -10;

        var pulse = 0.85 + Math.sin(t + p.phase) * 0.15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        var alpha = (p.a * pulse).toFixed(3);
        ctx.fillStyle = p.accent
          ? 'rgba(255,228,92,' + alpha + ')'
          : 'rgba(255,255,255,' + alpha + ')';
        ctx.fill();
      }
    }

    function tick() {
      draw();
      raf = requestAnimationFrame(tick);
    }
    function start() {
      if (raf) return;
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    resize();
    if (reduced) {
      // single static render
      draw();
    } else {
      start();
    }

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        if (reduced) draw();
      }, 200);
    });

    document.addEventListener('visibilitychange', function () {
      if (reduced) return;
      if (document.hidden) stop(); else start();
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (reduced) return;
          if (e.isIntersecting) start(); else stop();
        });
      }, { threshold: 0 });
      io.observe(canvas);
    }
  }

  /* =============================
     Hero CTA sticky (実験・SPのみ)
     FV を抜けたら .hero__cta に .is-stuck を付与し、CSS 側で画面下端に固定。
     戻すときはこの関数定義と DOMContentLoaded 内の呼び出しを削除。
     ============================= */
  function initHeroCtaSticky() {
    var cta = document.querySelector('.hero__cta');
    var hero = document.querySelector('.hero');
    if (!cta || !hero) return;

    var mq = window.matchMedia('(max-width: 767px)');
    var ticking = false;

    function update() {
      if (!mq.matches) {
        cta.classList.remove('is-stuck');
        return;
      }
      var heroBottom = hero.getBoundingClientRect().bottom;
      if (heroBottom < 0) {
        cta.classList.add('is-stuck');
      } else {
        cta.classList.remove('is-stuck');
      }
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () { update(); ticking = false; });
        ticking = true;
      }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* =============================
     Init
     ============================= */
  document.addEventListener('DOMContentLoaded', function () {
    initScrollAnimations();
    initHeader();
    initLineupScroll();
    initFloatingCta();
    initHeroDots();
    initHeroCtaSticky();
  });
})();
