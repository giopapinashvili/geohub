// Real user mode: clear mock conversations, show empty inbox
document.addEventListener('DOMContentLoaded', function () {
  if (!window.GeoMode || !window.GeoMode.isRealUser()) return;

  var convList = document.getElementById('convList');
  if (convList) convList.innerHTML =
    '<div class="conv-empty" style="padding:48px 20px;text-align:center">' +
      '<i class="fas fa-envelope-open" style="font-size:2rem;opacity:0.25;display:block;margin-bottom:12px"></i>' +
      '<p style="color:var(--text-muted);line-height:1.6">No conversations yet.<br>Start exploring and connect with people!</p>' +
    '</div>';

  var chatMessages = document.getElementById('chatMessages');
  if (chatMessages) chatMessages.innerHTML =
    '<div class="chat-empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;opacity:0.5">' +
      '<i class="fas fa-comments" style="font-size:2.5rem"></i>' +
      '<p style="text-align:center;line-height:1.6;color:var(--text-muted)">Select a conversation<br>or start a new one</p>' +
    '</div>';

  var chatHeader = document.getElementById('chatHeader');
  if (chatHeader) chatHeader.innerHTML =
    '<div style="padding:18px 20px;font-weight:700;font-size:1rem">Messages</div>';

  var quickReplies = document.getElementById('quickRepliesBar');
  if (quickReplies) quickReplies.style.display = 'none';

  var infoPanel = document.getElementById('infoPanel');
  if (infoPanel) { infoPanel.innerHTML = ''; infoPanel.style.display = 'none'; }

  var layout = document.querySelector('.messages-layout');
  if (layout) layout.style.gridTemplateColumns = '288px 1fr';

  var badge = document.querySelector('.msg-nav-badge');
  if (badge) badge.style.display = 'none';
});
