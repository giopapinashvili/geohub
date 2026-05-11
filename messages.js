/* GeoHub messages legacy mock disabled for production Firebase mode.
   Real messaging is handled by real-messages.js + firestore-social.js. */
(function(){
  window.showToast = window.showToast || function(msg){
    var toast=document.getElementById('msgToast');
    if(toast){ toast.textContent=msg; toast.classList.add('show'); setTimeout(function(){toast.classList.remove('show');},2500); }
    else console.log(msg);
  };
  window.setFilter = window.setFilter || function(filter, el){
    document.querySelectorAll('.filter-tab').forEach(function(t){t.classList.remove('active');});
    if(el) el.classList.add('active');
  };
  window.searchConvs = window.searchConvs || function(){};
  window.toggleEmojiPicker = window.toggleEmojiPicker || function(){
    var p=document.getElementById('emojiPicker'); if(!p)return; p.style.display = p.style.display==='flex'?'none':'flex';
  };
})();
