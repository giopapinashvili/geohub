/* Production messages page: layout only. Real data is rendered by real-messages.js. */
document.addEventListener('DOMContentLoaded', function(){
  var infoPanel=document.getElementById('infoPanel');
  if(infoPanel){ infoPanel.innerHTML=''; infoPanel.style.display='none'; }
  var layout=document.querySelector('.messages-layout');
  if(layout) layout.style.gridTemplateColumns='288px 1fr';
});
