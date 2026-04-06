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
     Init
     ============================= */
  document.addEventListener('DOMContentLoaded', function () {
    initScrollAnimations();
    initHeader();
    initLineupScroll();
    initFloatingCta();
  });
})();
