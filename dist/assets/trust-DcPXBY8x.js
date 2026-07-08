import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               *//* empty css               *//* empty css                               *//* empty css                   */import"./responsive-polish-BO79aqv7.js";import"./firebase-config-CGKVrgHh.js";import"./config-DSeD8I2H.js";import"./api-client-DV25UnBD.js";import"./main-CYAfAwpP.js";import"./account-BJSGhbLy.js";import"./mobile-nav-DsKLv3RI.js";import"./chat-popup-MADaMnFN.js";import"./geohub-production-stabilization-v1-D4HPXa7T.js";import"./analytics-DyGaP85h.js";import"https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";import"https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";import"https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";import"https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";import"https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";import"https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";(function(){var a=null;try{a=window.GeoAuth&&window.GeoAuth.getCurrentUser&&window.GeoAuth.getCurrentUser()||window.GeoCurrentUser||null}catch{}var e=a&&a.trustScore?a.trustScore:0;window._MY_TRUST_SCORE=e})();const c={score:window._MY_TRUST_SCORE||0,maxScore:1e3,nextLevelMin:0,nextLevelMax:300,breakdown:[{label:"Real Check-ins",icon:"fas fa-map-marker-alt",color:"#10b981",score:0,max:300,desc:"No check-ins yet"},{label:"Review Quality",icon:"fas fa-star",color:"#f59e0b",score:0,max:250,desc:"No reviews yet"},{label:"Camera Proofs",icon:"fas fa-camera",color:"#3b82f6",score:0,max:250,desc:"No camera proofs yet"},{label:"Community Trust",icon:"fas fa-users",color:"#a78bfa",score:0,max:150,desc:"No community votes yet"},{label:"Safety Record",icon:"fas fa-shield-alt",color:"#22c55e",score:0,max:50,desc:"Clean record"}],badges:[{label:"Email Verified",icon:"fas fa-envelope",color:"#3b82f6"}]},u=[{index:0,name:"Unverified",icon:"fas fa-user",color:"#64748b",range:"0–100",requirements:["Create a GeoHub account"],benefits:["Browse listings","Save to wishlist"],done:!0,current:!1,locked:!1},{index:1,name:"Basic Verified",icon:"fas fa-check-circle",color:"#3b82f6",range:"101–300",requirements:["Verify email address","Add phone number","Complete your profile (80%)"],benefits:["Write reviews","Add check-ins","Message businesses","Join events"],done:!0,current:!1,locked:!1},{index:2,name:"Camera Proof",icon:"fas fa-camera",color:"#22c55e",range:"301–500",requirements:["5+ camera-verified check-ins","GPS + timestamp embedded","AI image match passed"],benefits:["Camera Proof badge on reviews","Higher review weight in rankings","Creator eligibility"],done:!0,current:!1,locked:!1},{index:3,name:"Trusted Explorer",icon:"fas fa-shield-alt",color:"#10b981",range:"501–800",requirements:["30+ real check-ins","10+ quality reviews","3+ camera proofs","No active warnings"],benefits:["Trusted badge on profile","Priority in search results","Full business contact access","Event organizer tools"],done:!1,current:!0,locked:!1},{index:4,name:"Community Trusted",icon:"fas fa-users",color:"#f59e0b",range:"801–950",requirements:["15+ community votes from other members","6+ months active","50+ check-ins","Zero dispute record"],benefits:["Gold trust badge","Content moderation access","Creator sponsorship access","Featured profile slot"],done:!1,current:!1,locked:!0},{index:5,name:"Business Verified",icon:"fas fa-building",color:"#a78bfa",range:"901–1000",requirements:["Business registration document","Physical location GPS-verified","QR partner kit installed","GeoHub team review passed"],benefits:["Business Verified badge","Full analytics dashboard","Priority listing placement","GeoHub API access"],done:!1,current:!1,locked:!0}],l=[{id:"fake_review",label:"Fake Review",icon:"fas fa-star",color:"#f59e0b",desc:"Fabricated, paid or incentivised review"},{id:"fake_checkin",label:"Fake Check-in",icon:"fas fa-map-marker-alt",color:"#10b981",desc:"Check-in submitted without physical presence"},{id:"scam_biz",label:"Scam Business",icon:"fas fa-store-slash",color:"#ef4444",desc:"Business that deceives or defrauds customers"},{id:"bad_behavior",label:"Bad Behavior",icon:"fas fa-exclamation-circle",color:"#f97316",desc:"Harassment, hate speech or unsafe conduct"},{id:"unsafe_event",label:"Unsafe Event",icon:"fas fa-calendar-times",color:"#ef4444",desc:"Event with safety risks or misleading info"},{id:"fake_offer",label:"Fake Creator Offer",icon:"fas fa-handshake-slash",color:"#a78bfa",desc:"Fraudulent brand collaboration offer"}],v=[],b=[{icon:"fas fa-camera",color:"#3b82f6",label:"Camera Proof",desc:"Photo taken in-app with GPS + timestamp during visit"},{icon:"fas fa-redo",color:"#10b981",label:"Repeat Customer",desc:"Reviewer has visited this place 3+ times"},{icon:"fas fa-shield-alt",color:"#a78bfa",label:"Trusted Reviewer",desc:"Account has Trusted Explorer level or above"},{icon:"fas fa-qrcode",color:"#f59e0b",label:"QR Check-in",desc:"Physically scanned the business QR on location"},{icon:"fas fa-map-marker-alt",color:"#22c55e",label:"Verified Visit",desc:"GPS coordinates match business location within 50m"},{icon:"fas fa-exclamation-triangle",color:"#ef4444",label:"Suspicious Pattern",desc:"Unusual posting frequency or location mismatch detected"}];let f=null,p=[];function g(a,e){var t;document.querySelectorAll(".trust-tab").forEach(i=>i.classList.remove("active")),document.querySelectorAll(".trust-tab-panel").forEach(i=>i.classList.remove("active")),e&&e.classList.add("active"),(t=document.getElementById("tp-"+a))==null||t.classList.add("active")}function h(){const e=(c.score/c.maxScore*360).toFixed(1),t=document.getElementById("trustRing");t&&(t.style.background=`conic-gradient(#10b981 0deg ${e}deg, #0d1525 ${e}deg)`);const i=Math.min(100,Math.round((c.score-c.nextLevelMin)/(c.nextLevelMax-c.nextLevelMin)*100));setTimeout(()=>{const s=document.getElementById("nextLevelBar");s&&(s.style.width=i+"%")},400);const o=document.getElementById("trustBreakdown");o&&(o.innerHTML=c.breakdown.map(s=>{const d=Math.min(100,Math.round(s.score/s.max*100));return`
        <div class="bd-item">
          <div class="bd-header">
            <span class="bd-label"><i class="${s.icon}" style="color:${s.color}"></i> ${s.label}</span>
            <span class="bd-score">${s.score}<span class="bd-max">/${s.max}</span></span>
          </div>
          <div class="bd-track"><div class="bd-bar" data-pct="${d}" style="background:${s.color};width:0%"></div></div>
          <div class="bd-desc">${s.desc}</div>
        </div>`}).join(""),setTimeout(()=>document.querySelectorAll(".bd-bar").forEach(s=>{s.style.width=s.dataset.pct+"%"}),400));const r=document.getElementById("trustBadges");r&&(r.innerHTML=c.badges.map(s=>`
      <div class="tbadge-pill" style="--bc:${s.color}">
        <i class="${s.icon}"></i> ${s.label}
      </div>`).join(""));const n=document.getElementById("credibilityList");n&&(n.innerHTML=b.map(s=>`
      <div class="cred-item">
        <div class="cred-icon" style="color:${s.color};background:${s.color}18"><i class="${s.icon}"></i></div>
        <div>
          <div class="cred-label">${s.label}</div>
          <div class="cred-desc">${s.desc}</div>
        </div>
      </div>`).join(""))}function y(){const a=document.getElementById("levelsGrid");a&&(a.innerHTML=u.map(e=>`
    <div class="lv-card ${e.current?"lv-current":""} ${e.done&&!e.current?"lv-done":""} ${e.locked?"lv-locked":""}">
      <div class="lv-header">
        <div class="lv-icon" style="background:${e.color}18;border-color:${e.color}35;color:${e.color}">
          <i class="${e.icon}"></i>
        </div>
        <div>
          <div class="lv-name">${e.name}</div>
          <div class="lv-range">${e.range} pts</div>
        </div>
        ${e.current?'<span class="lv-badge lv-badge-current">Your Level</span>':""}
        ${e.done&&!e.current?'<span class="lv-badge lv-badge-done"><i class="fas fa-check"></i> Achieved</span>':""}
        ${e.locked?'<span class="lv-badge lv-badge-locked"><i class="fas fa-lock"></i></span>':""}
      </div>
      <div class="lv-section-title">Requirements</div>
      <div class="lv-reqs">
        ${e.requirements.map(t=>`
          <div class="lv-req ${e.done||e.current?"req-done":""}">
            <i class="fas fa-${e.done||e.current?"check-circle":"circle"}"></i>${t}
          </div>`).join("")}
      </div>
      <div class="lv-section-title">Benefits</div>
      <div class="lv-benefits">
        ${e.benefits.map(t=>`<div class="lv-benefit"><i class="fas fa-arrow-right"></i>${t}</div>`).join("")}
      </div>
    </div>`).join(""))}function k(){const a=document.getElementById("reportTypes");a&&(a.innerHTML=l.map(e=>`
    <div class="rt-card ${f===e.id?"rt-selected":""}" onclick="selectReportType('${e.id}')">
      <div class="rt-icon" style="color:${e.color};background:${e.color}18"><i class="${e.icon}"></i></div>
      <div class="rt-info">
        <div class="rt-label">${e.label}</div>
        <div class="rt-desc">${e.desc}</div>
      </div>
      <div class="rt-check"><i class="fas fa-check"></i></div>
    </div>`).join(""))}function $(a){var e,t,i;f=a,document.querySelectorAll(".rt-card").forEach(o=>o.classList.remove("rt-selected")),(e=document.querySelector(`.rt-card[onclick*="${a}"]`))==null||e.classList.add("rt-selected"),(t=document.getElementById("reportFormSection"))==null||t.classList.remove("hidden"),(i=document.getElementById("reportTypeError"))==null||i.classList.add("hidden")}function w(){const a=document.getElementById("safetyStats");a&&(a.innerHTML=`
      <div class="ss-admin-note">
        <i class="fas fa-shield-alt"></i>
        Safety statistics are reviewed and updated by the GeoHub admin team.
        Submitted reports are processed within 24–48 hours.
      </div>`);const e=document.getElementById("safetyFeed");if(e){const t={resolved:["badge-green","Resolved"],under_review:["badge-gold","Under Review"],dismissed:["badge-gray","Dismissed"],pending:["badge-blue","Pending"]},i=[...v,...p.slice(0,4)].sort((o,r)=>r.ts-o.ts).slice(0,10);e.innerHTML=i.map(o=>{const r=l.find(m=>m.id===o.type)||{label:o.type,icon:"fas fa-flag",color:"#64748b"},[n,s]=t[o.status]||["badge-gray",o.status],d=new Date(o.ts).toLocaleDateString([],{month:"short",day:"numeric"});return`
        <div class="sf-item">
          <div class="sf-icon" style="color:${r.color};background:${r.color}15"><i class="${r.icon}"></i></div>
          <div class="sf-info">
            <div class="sf-type">${r.label}</div>
            <div class="sf-target">${o.target}</div>
          </div>
          <div class="sf-meta">
            <span class="sf-badge ${n}">${s}</span>
            <span class="sf-date">${d}</span>
          </div>
        </div>`}).join("")||'<div class="sf-empty">No reports filed yet.</div>'}}document.addEventListener("DOMContentLoaded",()=>{h(),y(),k(),w();const a=new URLSearchParams(window.location.search);if(a.get("report")){const e=a.get("report"),t=a.get("target")||"";g("report",document.querySelector('.trust-tab[data-tab="report"]')),e&&setTimeout(()=>$(e),100),t&&setTimeout(()=>{const i=document.getElementById("reportTarget");i&&(i.value=t)},150)}});
