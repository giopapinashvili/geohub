/* ================================================================
   GeoHub — Share Module
   Web Share API with clipboard fallback for profile / post / place.
   ================================================================ */
(function () {
  'use strict';

  function getBaseUrl() {
    return window.location.origin || 'https://geohub.ge';
  }

  // ── TOAST ─────────────────────────────────────────────────────

  function showShareToast(msg, ok) {
    if (window.pushNotif) {
      window.pushNotif({ emoji: ok !== false ? '✅' : '⚠️', title: ok !== false ? 'Copied!' : 'Note', text: msg, link: null });
      return;
    }
    var t = document.getElementById('geo-share-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'geo-share-toast';
      t.style.cssText = 'position:fixed;bottom:84px;left:50%;transform:translateX(-50%) translateY(16px);background:#1e293b;color:#f1f5f9;border:1px solid rgba(255,255,255,.1);padding:9px 20px;border-radius:24px;font-size:.85rem;font-weight:600;z-index:99999;transition:all .25s;opacity:0;pointer-events:none;white-space:nowrap';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._t);
    t._t = setTimeout(function () {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(16px)';
    }, 2500);
  }

  // ── CLIPBOARD ─────────────────────────────────────────────────

  function copyToClipboard(url) {
    var doFallback = function () {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      showShareToast(ok ? 'Link copied!' : 'Long-press the link to copy', ok);
      return Promise.resolve(ok);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url)
        .then(function () { showShareToast('Link copied!', true); return true; })
        .catch(doFallback);
    }
    return doFallback();
  }

  // ── SHARE ─────────────────────────────────────────────────────

  function shareContent(title, text, url) {
    if (navigator.share) {
      return navigator.share({ title: title, text: text, url: url })
        .catch(function (err) {
          // AbortError = user cancelled — don't fall back to clipboard
          if (err && err.name !== 'AbortError') return copyToClipboard(url);
        });
    }
    return copyToClipboard(url);
  }

  function shareProfile(userId, displayName) {
    var url  = getBaseUrl() + '/profile.html?uid=' + userId;
    var name = displayName || 'this profile';
    return shareContent(
      name + ' on GeoHub',
      'Check out ' + name + ' on GeoHub — Georgia\'s local discovery platform!',
      url
    );
  }

  function sharePost(postId, previewText, city) {
    var url  = getBaseUrl() + '/feed.html?post=' + postId;
    var text = (previewText || '').slice(0, 80) || 'Check out this post on GeoHub';
    var title = 'GeoHub Post' + (city ? ' from ' + city : '');
    return shareContent(title, text, url);
  }

  function sharePlace(placeId, placeName, city) {
    var url  = getBaseUrl() + '/places.html?id=' + placeId;
    var name = placeName || 'this place';
    return shareContent(
      name + ' on GeoHub',
      'Check out ' + name + (city ? ' in ' + city : '') + ' on GeoHub!',
      url
    );
  }

  // Injects a share button into containerEl and wires it up
  function renderShareButton(containerEl, contentType, contentId, displayNameOrText, city) {
    if (!containerEl) return;
    var btn = document.createElement('button');
    btn.className = 'geo-share-btn';
    btn.setAttribute('aria-label', 'Share');
    btn.innerHTML = '<i class="fas fa-share-nodes"></i> Share';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (contentType === 'profile') shareProfile(contentId, displayNameOrText);
      else if (contentType === 'post')  sharePost(contentId,  displayNameOrText, city);
      else if (contentType === 'place') sharePlace(contentId, displayNameOrText, city);
      else copyToClipboard(window.location.href);
    });
    containerEl.appendChild(btn);
  }

  // ── EXPORT ────────────────────────────────────────────────────

  window.GeoShare = {
    shareProfile:       shareProfile,
    sharePost:          sharePost,
    sharePlace:         sharePlace,
    copyToClipboard:    copyToClipboard,
    renderShareButton:  renderShareButton,
  };
})();
