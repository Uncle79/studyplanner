const CACHE='study-cal-v6';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
const MSG={ko:n=>`오늘 복습할 항목 ${n}개가 기다리고 있어요 🧠`,en:n=>`${n} items are waiting for review today 🧠`,
  ja:n=>`今日の復習が${n}件あります 🧠`,zh:n=>`今天有 ${n} 项待复习 🧠`};
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys()
  .then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!=='meta').map(k=>caches.delete(k))))
  .then(()=>self.clients.claim())));

// 페이지: 네트워크 우선(항상 최신), 오프라인이면 캐시 / 나머지: 캐시 우선
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  if(r.mode==='navigate'){
    e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put('./index.html',c));return res})
      .catch(()=>caches.match('./index.html')));
  }else{
    e.respondWith(caches.match(r,{ignoreSearch:true}).then(h=>h||fetch(r).then(res=>{
      if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}return res})));
  }
});

// 앱 데이터 읽기 (DB가 없으면 만들지 않고 종료)
const readState=()=>new Promise(ok=>{
  const r=indexedDB.open('study-cal',1);
  r.onupgradeneeded=()=>r.transaction.abort();
  r.onerror=()=>ok(null);
  r.onsuccess=()=>{try{const q=r.result.transaction('kv').objectStore('kv').get('state');
    q.onsuccess=()=>{ok(q.result);r.result.close()};q.onerror=()=>ok(null)}catch(e){ok(null)}};
});

// 백그라운드 알림 (설치된 PWA + 브라우저가 허락할 때만 동작)
self.addEventListener('periodicsync',e=>{if(e.tag==='study-daily')e.waitUntil(daily())});
async function daily(){
  const S=await readState(); if(!S)return;
  const c=Object.assign({on:false,exam:false,time:'20:00'},S.notif), now=new Date(), t=ymd(now);
  const [h,m]=c.time.split(':').map(Number);
  if(now.getHours()*60+now.getMinutes()<h*60+m)return;
  const meta=await caches.open('meta'), last=await meta.match('last');
  if(last&&await last.text()===t)return;
  const msgs=[];
  if(c.on){const n=(S.notes||[]).filter(x=>x.due<=t).length+(S.words||[]).filter(x=>x.due<=t).length;
    if(n)msgs.push(['🧠 Study Calendar',(MSG[S.lang]||MSG.en)(n)])}
  if(c.exam)(S.events||[]).filter(x=>x.kind==='exam').forEach(x=>{
    const d=Math.round((new Date(x.date+'T00:00')-new Date(t+'T00:00'))/864e5);
    if([7,3,1,0].includes(d))msgs.push(['📝 '+x.title,d?'D-'+d:'D-Day'])});
  for(const [title,body] of msgs)await self.registration.showNotification(title,{body,icon:'icon-192.png',tag:title});
  await meta.put('last',new Response(t));
}
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true})
    .then(l=>l.length?l[0].focus():clients.openWindow('./?v=review')));
});
