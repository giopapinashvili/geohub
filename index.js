(function() {
  // Stat counter animation on scroll
  var statEls = document.querySelectorAll('.landing-stat strong[data-count]');
  if (!statEls.length) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var target = parseInt(el.dataset.count, 10);
      var suffix = el.dataset.suffix || '+';
      var duration = 1400;
      var startTime = null;

      function tick(now) {
        if (!startTime) startTime = now;
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var val = Math.round(eased * target);
        // format thousands
        if (target >= 1000) {
          var k = Math.round(val / 1000 * 10) / 10;
          el.textContent = (k % 1 === 0 ? k : k.toFixed(0)) + suffix;
        } else {
          el.textContent = val.toLocaleString() + suffix;
        }
        if (progress < 1) requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
      observer.unobserve(el);
    });
  }, { threshold: 0.6 });

  statEls.forEach(function(el) { observer.observe(el); });
})();
