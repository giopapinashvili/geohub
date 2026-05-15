/* GeoHub — Moderation UI helpers  (window.GeoModeration) */
(function () {
  'use strict';

  var REASONS = {
    post:     ['Spam', 'Hate speech', 'Violence / threats', 'Misinformation', 'Adult content', 'Copyright violation', 'Other'],
    comment:  ['Spam', 'Hate speech', 'Harassment', 'Violence / threats', 'Other'],
    user:     ['Spam / bot', 'Harassment', 'Impersonation', 'Fake account', 'Inappropriate content', 'Other'],
    place:    ['Fake / scam', 'Wrong information', 'Spam', 'Inappropriate content', 'Other'],
    business: ['Fake / scam', 'Wrong information', 'Spam', 'Inappropriate content', 'Other'],
    event:    ['Fake / scam', 'Wrong information', 'Spam', 'Inappropriate content', 'Other'],
    group:    ['Spam', 'Hate speech', 'Inappropriate content', 'Other']
  };

  function esc(s) {
    return String(s || '').replace(/[&<>'"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
    });
  }

  function rm(id) { var el = document.getElementById(id); if (el) el.remove(); }

  function overlay(id, inner) {
    rm(id);
    var wrap = document.createElement('div');
    wrap.id = id;
    wrap.className = 'mod-overlay';
    wrap.innerHTML = inner;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.remove(); });
    return wrap;
  }

  /* ── Report modal ── */
  function openReportModal(targetType, targetId, targetName) {
    var reasons = REASONS[targetType] || REASONS.post;
    var label = { post:'Post', comment:'Comment', user:'User', place:'Place', business:'Business', event:'Event', group:'Group' }[targetType] || 'Content';
    var el = overlay('ghReportModal',
      '<div class="mod-box">' +
        '<div class="mod-head">' +
          '<span class="mod-head-title"><i class="fas fa-flag"></i> Report ' + esc(label) + '</span>' +
          '<button class="mod-close" onclick="document.getElementById(\'ghReportModal\').remove()" aria-label="Close"><i class="fas fa-times"></i></button>' +
        '</div>' +
        (targetName ? '<div class="mod-target">' + esc(targetName) + '</div>' : '') +
        '<div class="mod-body">' +
          '<p class="mod-label">Why are you reporting this?</p>' +
          '<div class="mod-reasons" id="modReasons">' +
            reasons.map(function (r) {
              return '<button class="mod-reason" data-r="' + esc(r) + '">' + esc(r) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="mod-desc-wrap" id="modDescWrap" style="display:none">' +
            '<textarea class="mod-textarea" id="modDesc" placeholder="Add more context (optional)" maxlength="500"></textarea>' +
          '</div>' +
        '</div>' +
        '<div class="mod-foot">' +
          '<button class="mod-btn-cancel" onclick="document.getElementById(\'ghReportModal\').remove()">Cancel</button>' +
          '<button class="mod-btn-submit" id="modSubmit" disabled>Submit Report</button>' +
        '</div>' +
      '</div>'
    );
    var selectedReason = '';
    el.querySelector('#modReasons').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-r]');
      if (!btn) return;
      el.querySelectorAll('.mod-reason').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      selectedReason = btn.dataset.r;
      el.querySelector('#modDescWrap').style.display = 'block';
      el.querySelector('#modSubmit').disabled = false;
    });
    el.querySelector('#modSubmit').addEventListener('click', function () {
      if (!selectedReason) return;
      var descEl = el.querySelector('#modDesc');
      var details = descEl ? descEl.value.trim() : '';
      var btn = el.querySelector('#modSubmit');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      var GS = window.GeoSocial;
      if (GS && GS.reportTarget) {
        GS.reportTarget(targetType, targetId, selectedReason, details, function () { rm('ghReportModal'); });
      } else {
        rm('ghReportModal');
      }
    });
  }

  /* ── Block confirm ── */
  function openBlockConfirm(userId, userName, onBlock) {
    var el = overlay('ghBlockConfirm',
      '<div class="mod-box mod-confirm">' +
        '<div class="mod-confirm-icon mod-icon-danger"><i class="fas fa-ban"></i></div>' +
        '<div class="mod-confirm-title">Block ' + esc(userName || 'this user') + '?</div>' +
        '<div class="mod-confirm-msg">Their posts, comments and messages will be hidden from you. You can unblock at any time from your settings.</div>' +
        '<div class="mod-foot">' +
          '<button class="mod-btn-cancel" onclick="document.getElementById(\'ghBlockConfirm\').remove()">Cancel</button>' +
          '<button class="mod-btn-danger" id="modBlockOk">Block User</button>' +
        '</div>' +
      '</div>'
    );
    el.querySelector('#modBlockOk').addEventListener('click', function () {
      rm('ghBlockConfirm');
      if (typeof onBlock === 'function') onBlock();
    });
  }

  /* ── Mute confirm ── */
  function openMuteConfirm(userId, userName, onMute) {
    var el = overlay('ghMuteConfirm',
      '<div class="mod-box mod-confirm">' +
        '<div class="mod-confirm-icon mod-icon-warn"><i class="fas fa-volume-mute"></i></div>' +
        '<div class="mod-confirm-title">Mute ' + esc(userName || 'this user') + '?</div>' +
        '<div class="mod-confirm-msg">Their posts won\'t appear in your feed. They can still interact with your content and won\'t know they\'ve been muted.</div>' +
        '<div class="mod-foot">' +
          '<button class="mod-btn-cancel" onclick="document.getElementById(\'ghMuteConfirm\').remove()">Cancel</button>' +
          '<button class="mod-btn-warn" id="modMuteOk">Mute User</button>' +
        '</div>' +
      '</div>'
    );
    el.querySelector('#modMuteOk').addEventListener('click', function () {
      rm('ghMuteConfirm');
      if (typeof onMute === 'function') onMute();
    });
  }

  window.GeoModeration = {
    openReportModal:  openReportModal,
    openBlockConfirm: openBlockConfirm,
    openMuteConfirm:  openMuteConfirm
  };
})();
