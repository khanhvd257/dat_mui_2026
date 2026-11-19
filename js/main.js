/* Tương tác chung: header, parallax hero, fade-in/reveal, lightbox */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----- Header đổi nền khi cuộn + parallax nhẹ ở hero ----- */
  var header = document.getElementById('header');
  var hero = document.getElementById('hero');
  var layers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    header.classList.toggle('is-scrolled', y > 40);
    if (!reduce && hero && y < hero.offsetHeight * 1.1) {
      layers.forEach(function (l) { l.style.transform = 'translate3d(0,' + (y * parseFloat(l.dataset.parallax)).toFixed(1) + 'px,0)'; });
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ----- Fade-in & image reveal khi cuộn ----- */
  var items = document.querySelectorAll('.reveal, .img-reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el, i) {
      // so le nhẹ giữa các ảnh trong cùng lưới
      if (el.classList.contains('g')) el.style.transitionDelay = ((i % 3) * 90) + 'ms';
      io.observe(el);
    });
  } else {
    items.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ----- Lightbox ----- */
  var lb = document.getElementById('lightbox');
  var lbImg = lb.querySelector('img');
  var lbCap = lb.querySelector('figcaption');
  var thumbs = Array.prototype.slice.call(document.querySelectorAll('.g'));
  var idx = 0, lastFocus = null;

  function show(i) {
    idx = (i + thumbs.length) % thumbs.length;
    var img = thumbs[idx].querySelector('img');
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.innerHTML = '';
    lbCap.appendChild(document.createTextNode(img.dataset.caption || img.alt));
    if (img.dataset.credit) {
      var s = document.createElement('small'); s.textContent = 'Ảnh: ' + img.dataset.credit; lbCap.appendChild(s);
    }
  }
  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { lb.classList.add('is-open'); });
    lb.querySelector('.lightbox__close').focus();
  }
  function close() {
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(function () { lb.hidden = true; lbImg.removeAttribute('src'); }, 300);
    if (lastFocus) lastFocus.focus();
  }

  thumbs.forEach(function (t, i) { t.addEventListener('click', function () { open(i); }); });
  lb.querySelector('.lightbox__close').addEventListener('click', close);
  lb.querySelector('.lightbox__nav--prev').addEventListener('click', function () { show(idx - 1); });
  lb.querySelector('.lightbox__nav--next').addEventListener('click', function () { show(idx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'ArrowRight') show(idx + 1);
  });

  // vuốt trái/phải trên mobile
  var x0 = null;
  lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
  });
})();
