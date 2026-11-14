/* The Photon Academy - Student Space (login, profile, dashboard, Teacher Desk base).
   Loaded only when someone opens Student Space, so the public pages stay light.
   Wrapped so nothing leaks into the global scope; it exposes window.__ssCube and window.__ssInit only. */
(function(){
window.__ssCube=function(){if(window.__ssCubed)return;if(document.documentElement.classList.contains('lite'))return;window.__ssCubed=true;
  var cube=document.getElementById('ss-cube');if(!cube)return;
  var tint={f:['rgba(79,214,232,.20)','rgba(79,214,232,.35)'],b:['rgba(124,108,240,.22)','rgba(124,108,240,.35)'],r:['rgba(242,102,139,.16)','rgba(242,102,139,.30)'],l:['rgba(240,180,41,.13)','rgba(240,180,41,.28)'],t:['rgba(238,242,251,.14)','rgba(238,242,251,.22)'],d:['rgba(79,140,246,.18)','rgba(79,140,246,.32)']};
  function d(c){var e=document.createElement('div');e.className=c;return e}
  var top=d('ly t'),bot=d('ly b');
  for(var x=-1;x<=1;x++)for(var y=-1;y<=1;y++)for(var z=-1;z<=1;z++){
    var cb=d('cb');cb.style.transform='translate3d(calc(var(--s) * '+x+'),calc(var(--s) * '+y+'),calc(var(--s) * '+z+'))';
    [['f0',z===1,'f'],['f1',z===-1,'b'],['f2',x===1,'r'],['f3',x===-1,'l'],['f4',y===-1,'t'],['f5',y===1,'d']].forEach(function(f){
      if(!f[1])return;var fc=d('fc '+f[0]);fc.style.setProperty('--c',tint[f[2]][0]);fc.style.setProperty('--g',tint[f[2]][1]);cb.appendChild(fc)});
    (y===-1?top:y===1?bot:cube).appendChild(cb)}
  cube.appendChild(top);cube.appendChild(bot);
};
window.__ssInit=function(){if(window.__ssInited)return;window.__ssInited=true;if(!window.photonSupabase)return;

const sb=window.photonSupabase;
const root=document.getElementById('ss-root'),outEl={replaceChildren(){}};
const PAGE=location.origin+window.__photonRoute().base+'index.html';
function el(t,a,...k){const e=document.createElement(t);for(const x in a||{}){x==='class'?e.className=a[x]:x.startsWith('on')?e.addEventListener(x.slice(2),a[x]):e.setAttribute(x,a[x])}k.flat().forEach(c=>c!=null&&c!==false&&e.append(c.nodeType?c:document.createTextNode(c)));return e}
function show(...k){root.replaceChildren(...k.filter(Boolean))}
async function signout(){await sb.auth.signOut();location.reload()}
function setOut(on){outEl.replaceChildren(on?el('button',{onclick:signout},'Sign out'):'')}
const sod=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
const left=iso=>Math.round((sod(new Date(iso))-sod(new Date()))/864e5);
const leftTxt=n=>n<0?'overdue':n===0?'Today':n===1?'1 day left':n+' days left';
const fmt=iso=>new Date(iso).toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
const asc=(a,b)=>new Date(a.due_at)-new Date(b.due_at);
/* ---------- login / sign up ---------- */
function form(){
  setOut(false);
  const msg=el('div',{class:'msg'});
  const btn=el('button',{type:'button',class:'pri gbtn'});
  btn.innerHTML='<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg><span>Continue with Google</span>';
  btn.onclick=async()=>{
    msg.className='msg';msg.textContent='';btn.disabled=true;
    try{sessionStorage.setItem('photonAfterLogin','student')}catch(e){}
    const r=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:PAGE,queryParams:{prompt:'select_account'}}});
    if(r.error){btn.disabled=false;msg.className='msg bad';msg.textContent=/provider|enabled|unsupported/i.test(r.error.message||'')?'Google sign-in is not set up yet. Please tell the academy.':'Could not start Google sign-in. Please try again.'}
  };
  show(el('div',{class:'box'},el('h1',{},'Student login'),
    el('p',{},'Sign in with your Google account. New students create their profile after signing in, and the academy approves every new account.'),
    btn,msg,el('p',{style:'font-size:13px'},'We never see your Google password. ',el('a',{href:'?page=privacy'},'Privacy policy'))));
}

/* ---------- profile form (used while pending, and from "Edit profile") ---------- */
const REQ=['class_name','board','school','dob','parent_name','parent_phone','photo_path'];
function profileForm(session,data,after){
  const uid=session.user.id,F={};
  const inp=(k,label,attrs)=>{F[k]=el('input',Object.assign({maxlength:'120'},attrs||{}));F[k].value=data[k]||'';return [el('label',{},label),F[k]]};
  const sel=(k,label,opts)=>{const x=el('select',{},el('option',{value:''},'Select…'),...opts.map(o=>el('option',{value:o},o)));x.value=data[k]||'';F[k]=x;return [el('label',{},label),x]};
  F.display_name=el('input',{maxlength:'60'});F.display_name.value=data.display_name||'';
  const photo=el('input',{type:'file',accept:'image/jpeg,image/png,image/webp'});
  const msg=el('div',{class:'msg'});const bad=t=>{msg.className='msg bad';msg.textContent=t};
  const save=el('button',{type:'button',class:'pri'},'Save details');
  save.onclick=async()=>{
    msg.className='msg';msg.textContent='';const v=k=>F[k].value.trim();
    if(v('display_name').length<3)return bad('Enter your full name.');
    for(const [k,l] of [['class_name','your class'],['board','your board'],['school','your school name'],['parent_name','a parent or guardian name']])if(!v(k))return bad('Please enter '+l+'.');
    const dob=v('dob');if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||isNaN(Date.parse(dob))||Date.parse(dob)>Date.now()||Date.parse(dob)<Date.parse('1990-01-01'))return bad('Enter a valid date of birth.');
    const ph=x=>{const d=x.replace(/\D/g,'');return /^[+\d][\d\s\-()]{5,24}$/.test(x)&&d.length>=7&&d.length<=15};
    if(!ph(v('parent_phone')))return bad('Enter a valid parent phone number.');
    if(v('phone')&&!ph(v('phone')))return bad('Enter a valid student phone number or leave it empty.');
    const f=photo.files[0];if(!f&&!data.photo_path)return bad('Please add your photo.');
    if(f&&(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>3*1024*1024))return bad('Photo must be a JPG, PNG or WebP under 3 MB.');
    save.disabled=true;save.textContent='Saving…';let path=data.photo_path;
    if(f){const ext=f.type==='image/png'?'png':f.type==='image/webp'?'webp':'jpg',np=uid+'/photo.'+ext;
      const up=await sb.storage.from('student-photos').upload(np,f,{upsert:true,contentType:f.type});
      if(up.error){save.disabled=false;save.textContent='Save details';return bad('Could not upload the photo. Please try again.')}
      if(path&&path!==np)await sb.storage.from('student-photos').remove([path]);path=np}
    const r=await sb.from('profiles').update({display_name:v('display_name'),class_name:v('class_name'),board:v('board'),school:v('school'),dob,parent_name:v('parent_name'),parent_phone:v('parent_phone'),phone:v('phone')||null,address:v('address')||null,photo_path:path}).eq('id',uid);
    save.disabled=false;save.textContent='Save details';
    if(r.error)return bad('Could not save. Please try again.');
    if(data.student_status!=='approved'){try{await sb.functions.invoke('notify-student',{body:{}})}catch(e){}}
    after()};
  F.address=el('input',{maxlength:'200'});F.address.value=data.address||'';
  setTimeout(()=>{if(data.student_status==='approved'&&F.class_name&&F.board){F.class_name.disabled=true;F.board.disabled=true;F.board.insertAdjacentElement('afterend',el('small',{style:'display:block;color:var(--mu);margin-top:4px'},'Class and board can only be changed by the academy.'))}},0);
  return el('div',{},el('label',{},'Full name'),F.display_name,
    ...sel('class_name','Class',['6','7','8','9','10','11','12']),...sel('board','Board',['CBSE','ICSE','GSEB']),
    ...inp('school','School name'),...inp('dob','Date of birth',{type:'date'}),...inp('parent_name','Parent / guardian name'),
    ...inp('parent_phone','Parent phone',{type:'tel'}),...inp('phone','Your phone (optional)',{type:'tel'}),
    el('label',{},'Address / city (optional)'),F.address,el('label',{},'Your photo (JPG, PNG or WebP, max 3 MB)'),photo,save,msg);
}


/* ---------- dashboard ---------- */
const DAYS=['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const wdn=d=>(d.getDay()+6)%7+1;
const mins=s=>{const p=s.slice(0,5).split(':').map(Number);return p[0]*60+p[1]};
const t12=s=>{let p=s.slice(0,5).split(':').map(Number),h=p[0],ap=h>=12?'PM':'AM';h=h%12||12;return h+':'+String(p[1]).padStart(2,'0')+' '+ap};
const cd=ms=>{if(ms<=0)return 'Now';const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;return (d>0?d+'d ':'')+h+'h '+m+'m '+x+'s'};
let STREAK={cur:0,best:0,days:new Set(),today:''},P=null,UID=null,D={items:[],tt:[],notes:[],ch:[],done:new Set()},photoUrl=null,calM=null,calSel=null,C=null,timers=[];
const byStart=(a,b)=>mins(a.start_time)-mins(b.start_time);
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function effective(date){
  const wd=wdn(date),ds=ymd(date);
  let base=D.tt.filter(x=>x.weekday===wd).map(x=>({...x,state:'normal'}));
  D.ch.filter(c=>c.on_date===ds).forEach(c=>{
    const o=c.orig_start_time?c.orig_start_time.slice(0,5):null;
    if(c.kind==='cancelled'){base.forEach(b=>{if(b.start_time.slice(0,5)===o){b.state='cancelled';b.note=c.note}})}
    else if(c.kind==='changed'){const i=base.findIndex(b=>b.start_time.slice(0,5)===o);const n={weekday:wd,start_time:c.start_time,end_time:c.end_time,subject:c.subject,teacher:c.teacher,room:c.room,state:'changed',note:c.note,was:i>=0?base[i].subject:null};if(i>=0)base[i]=n;else base.push(n)}
    else base.push({weekday:wd,start_time:c.start_time,end_time:c.end_time,subject:c.subject,teacher:c.teacher,room:c.room,state:'extra',note:c.note});
  });
  return base.sort(byStart);
}
function classLine(){
  const now=new Date(),m=now.getHours()*60+now.getMinutes();
  if(!D.tt.length&&!D.ch.length)return 'No classes added yet for your class';
  const today=effective(now),live=today.filter(x=>x.state!=='cancelled'),cx=today.filter(x=>x.state==='cancelled');
  const tail=cx.length?' · Cancelled today: '+cx.map(x=>x.subject).join(', '):'';
  const tag=x=>x.state==='changed'?' (changed)':x.state==='extra'?' (extra class)':'';
  const cur=live.find(x=>mins(x.start_time)<=m&&m<mins(x.end_time));
  if(cur)return '● Now: '+cur.subject+tag(cur)+' (until '+t12(cur.end_time)+')'+tail;
  const nx=live.find(x=>mins(x.start_time)>m);
  if(nx)return 'Next class: '+nx.subject+' at '+t12(nx.start_time)+tag(nx)+tail;
  for(let i=1;i<=7;i++){const d=new Date(now);d.setDate(now.getDate()+i);const l=effective(d).filter(x=>x.state!=='cancelled')[0];if(l)return 'Next class: '+l.subject+' · '+(i===1?'Tomorrow':DAYS[wdn(d)])+' '+t12(l.start_time)+tail}
  return 'No more classes this week'+tail;
}
function tick(){
  if(document.hidden)return;
  const n=Date.now(),d=new Date();
  document.querySelectorAll('[data-cd]').forEach(e=>{e.textContent=cd(new Date(e.getAttribute('data-cd'))-n)});
  const c=document.getElementById('ss-clock');if(c)c.textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const dl=document.getElementById('ss-dateline');if(dl)dl.textContent=d.toLocaleDateString([], {weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const cb=document.getElementById('ss-clsBox');if(cb)cb.textContent=classLine();
}

const istToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const ymdAdd=(t,n)=>{const d=new Date(t+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
async function recordVisit(){
  const t=istToday();
  try{await sb.from('student_visits').upsert({student_id:UID,visit_date:t},{onConflict:'student_id,visit_date',ignoreDuplicates:true})}catch(e){}
  let rows=[];try{const r=await sb.from('student_visits').select('visit_date').gte('visit_date',ymdAdd(t,-420)).order('visit_date',{ascending:false}).limit(500);rows=(r&&r.data)||[]}catch(e){}
  const days=new Set(rows.map(x=>x.visit_date));
  let cur=0,k=days.has(t)?t:ymdAdd(t,-1);while(days.has(k)){cur++;k=ymdAdd(k,-1)}
  const asc2=[...days].sort();let best=0,run=0,prev=null;
  asc2.forEach(d=>{run=(prev&&ymdAdd(prev,1)===d)?run+1:1;if(run>best)best=run;prev=d});
  STREAK={cur,best:Math.max(best,cur),days,today:t};
}
function flameEl(){const f=el('span',{class:'flame'});f.innerHTML='<svg viewBox="0 0 24 30" width="22" height="27" aria-hidden="true"><defs><linearGradient id="ssFl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a1f"/><stop offset=".6" stop-color="#ff9a3c"/><stop offset="1" stop-color="#ffd35c"/></linearGradient></defs><path fill="url(#ssFl)" d="M12 1c1 4.5 6.5 7.2 6.5 14.2A6.5 6.5 0 0 1 12 22a6.5 6.5 0 0 1-6.5-6.8C5.5 12 7 10.2 8.2 8.7 8.5 11 9.6 11.8 10.3 11.8 10.3 8 11 4.4 12 1z"/><path fill="#fff3c4" opacity=".85" d="M12 14c.6 2 3 3.2 3 5.6A3 3 0 0 1 12 22.5a3 3 0 0 1-3-2.9c0-1.6 1.2-2.4 1.9-3.6.3.7.6 1 1.1 1 0-1.4 0-2.2 0-3z"/></svg>';return f}
function streakChip(){const c=STREAK.cur;return el('span',{class:'chip streak'+(c>=30?' s30':c>=7?' s7':'')},flameEl(),' '+c+(c===1?' day':' days')+' streak')}
function streakRow(){
  const t=STREAK.today||istToday(),d0=new Date(t+'T12:00:00'),wd=wdn(d0),dots=[];
  for(let i=1;i<=7;i++){const d=new Date(d0);d.setDate(d0.getDate()+i-wd);const k=ymd(d);dots.push(el('i',{class:(STREAK.days.has(k)?'on':'')+(k===t?' td':''),title:DAYS[i]}))}
  return el('div',{class:'wk7'},...dots,el('small',{},STREAK.cur<=1?'Open Student Space every day to build your streak':'Best streak: '+STREAK.best+' days'));
}
function heroEl(editBtn){
  const nt=D.items.filter(i=>i.kind==='test'&&new Date(i.due_at)>Date.now()).sort(asc)[0];
  const ph=photoUrl?el('img',{class:'ph',src:photoUrl,alt:'Your photo'}):el('div',{class:'ph'},(P.display_name||'?').trim().charAt(0).toUpperCase());
  return el('div',{class:'top'},
    el('div',{class:'who'},ph,el('div',{},el('h1',{},P.display_name||''),
      el('div',{},el('span',{class:'chip'},'Class '+(P.class_name||'-')+(P.board?' · '+P.board:'')+(P.division?' · Division '+P.division:'')),P.school?el('span',{class:'chip'},P.school):null,el('span',{class:'chip',style:'color:var(--ok)'},'✓ Approved'),streakChip()),streakRow(),editBtn)),
    el('div',{class:'live'},el('div',{id:'ss-clock',class:'clock'}),el('div',{id:'ss-dateline',class:'dl'}),
      nt?el('div',{class:'nt'},'Next test: '+nt.title+' in ',el('b',{'data-cd':nt.due_at},cd(new Date(nt.due_at)-Date.now()))):el('div',{class:'nt dl'},'No upcoming test'),
      el('div',{id:'ss-clsBox',class:'dl'},classLine())));
}
function testsEl(){
  const now=Date.now(),up=D.items.filter(i=>i.kind==='test'&&new Date(i.due_at)>now-3*36e5).sort(asc);
  const c=el('div',{class:'card'},el('h2',{},'Test tracker'+(up.length?' ('+up.length+')':'')));
  if(!up.length){c.append(el('div',{class:'empty'},'No tests scheduled right now.'));return c}
  up.forEach(t=>{const due=new Date(t.due_at),cr=new Date(t.created_at||now),pct=Math.max(3,Math.min(100,(now-cr)/Math.max(1,due-cr)*100)),dl=left(t.due_at);
    c.append(el('div',{class:'tt'},el('div',{class:'row'},el('div',{},el('b',{},t.title),el('small',{},(t.subject?t.subject+' · ':'')+fmt(t.due_at))),
      el('span',{class:'pill big'+(dl<=0?' late':dl<=2?' am':''),'data-cd':t.due_at},cd(due-now))),el('div',{class:'bar2'},el('i',{style:'width:'+pct+'%'})),t.notes?el('small',{},t.notes):null))});
  return c;
}
function calEl(){
  const td=new Date();if(!calM)calM={y:td.getFullYear(),m:td.getMonth()};
  const key=d=>d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate(),by=new Map();
  D.items.forEach(it=>{const k=key(new Date(it.due_at));if(!by.has(k))by.set(k,[]);by.get(k).push(it)});
  const go=n=>{calM.m+=n;if(calM.m<0){calM.m=11;calM.y--}if(calM.m>11){calM.m=0;calM.y++}calSel=null;C.cal.replaceChildren(calEl())};
  const nav=el('div',{class:'cnav'},el('b',{},new Date(calM.y,calM.m,1).toLocaleDateString([], {month:'long',year:'numeric'})),
    el('div',{},el('button',{onclick:()=>go(-1)},'‹'),el('button',{onclick:()=>{calM=null;calSel=null;C.cal.replaceChildren(calEl())}},'Today'),el('button',{onclick:()=>go(1)},'›')));
  const g=el('div',{class:'cal'},...['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>el('div',{class:'dow'},d)));
  const first=(new Date(calM.y,calM.m,1).getDay()+6)%7,dim=new Date(calM.y,calM.m+1,0).getDate();
  for(let i=0;i<first;i++)g.append(el('div',{class:'cell empty'}));
  for(let d=1;d<=dim;d++){const dt=new Date(calM.y,calM.m,d),its=(by.get(key(dt))||[]).sort(asc);
    g.append(el('button',{type:'button',class:'cell'+(key(dt)===key(td)?' today':'')+(calSel===d?' sel':''),onclick:()=>{calSel=d;C.cal.replaceChildren(calEl())}},
      el('span',{class:'dn'},String(d)),...its.slice(0,2).map(i=>el('span',{class:'ev '+(i.kind==='test'?'t':'h')},i.title)),its.length>2?el('span',{class:'more'},'+'+(its.length-2)+' more'):null))}
  let info;
  if(calSel){const dt=new Date(calM.y,calM.m,calSel),its=(by.get(key(dt))||[]).sort(asc),cl=effective(dt).filter(x=>x.state!=='cancelled');
    info=el('div',{class:'dayinfo'},el('b',{},dt.toLocaleDateString([], {weekday:'long',day:'numeric',month:'long'})),
      ...its.map(i=>el('div',{},(i.kind==='test'?'📝 ':'📚 ')+i.title+(i.subject?' · '+i.subject:'')+' — '+new Date(i.due_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))),
      !its.length?el('div',{class:'empty'},'No tests or homework on this day.'):null,
      cl.length?el('div',{style:'color:var(--mu);margin-top:6px'},'Classes: '+cl.map(x=>t12(x.start_time)+' '+x.subject).join(' · ')):null)}
  else info=el('div',{class:'dayinfo',style:'color:var(--mu)'},'Tap a day for details. Blue = test, orange = homework. It updates by itself.');
  return el('div',{},el('h2',{},'Calendar'),nav,g,info);
}
function weekEl(){
  const c=el('div',{class:'card'},el('h2',{},'Weekly class schedule'));
  if(!D.tt.length&&!D.ch.length){c.append(el('div',{class:'empty'},'No classes added yet for your class.'));return c}
  const now=new Date(),wd=wdn(now),m=now.getHours()*60+now.getMinutes();
  const mon=new Date(now);mon.setDate(now.getDate()-(wd-1));
  const days=[1,2,3,4,5,6,7].map(w=>{const dt=new Date(mon);dt.setDate(mon.getDate()+w-1);return {w,dt,sl:effective(dt)}}).filter(x=>x.w<=6||x.sl.length);
  const g=el('div',{class:'week'});
  days.forEach(({w,dt,sl})=>{
    const col=el('div',{class:'wd'+(w===wd?' today':'')},el('div',{class:'wh'},DAYS[w].slice(0,3)+' '+dt.getDate()));
    if(!sl.length)col.append(el('div',{class:'free'},'No class'));
    sl.forEach(s=>{const lv=w===wd&&s.state!=='cancelled'&&mins(s.start_time)<=m&&m<mins(s.end_time);
      col.append(el('div',{class:'slot'+(lv?' live':'')+(s.state!=='normal'?' '+s.state:'')},
        el('b',{},t12(s.start_time)+' – '+t12(s.end_time)),el('div',{},s.subject),
        (s.teacher||s.room)?el('small',{},[s.teacher,s.room?'Room '+s.room:''].filter(Boolean).join(' · ')):null,
        s.state==='cancelled'?el('small',{class:'tg tbad'},'✕ Cancelled'+(s.note?' · '+s.note:'')):s.state==='changed'?el('small',{class:'tg tam'},'↻ Changed'+(s.was?' (was '+s.was+')':'')+(s.note?' · '+s.note:'')):s.state==='extra'?el('small',{class:'tg tex'},'＋ Extra class'+(s.note?' · '+s.note:'')):(s.note?el('small',{},s.note):null),
        lv?el('small',{class:'lv'},'● Live now'):null))});
    g.append(col)});
  c.append(g);return c;
}
function hwEl(){
  const hw=D.items.filter(i=>i.kind==='homework').sort(asc);
  const c=el('div',{class:'card'},el('h2',{},'Homework checklist'));
  if(!hw.length){c.append(el('div',{class:'empty'},'No homework right now.'));return c}
  hw.forEach(i=>{const d=left(i.due_at),isDone=D.done.has(i.id);
    const cb=el('input',{type:'checkbox',style:'width:22px;height:22px;min-height:0;padding:0;border:0;background:none;accent-color:#4fd6e8;margin:2px 12px 0 0;flex:none'});cb.checked=isDone;
    cb.addEventListener('change',async()=>{
      const on=cb.checked;if(on)D.done.add(i.id);else D.done.delete(i.id);
      const r=on?await sb.from('schedule_done').insert({student_id:UID,item_id:i.id}):await sb.from('schedule_done').delete().eq('student_id',UID).eq('item_id',i.id);
      if(r&&r.error){if(on)D.done.delete(i.id);else D.done.add(i.id)}
      C.hw.replaceChildren(hwEl())});
    c.append(el('div',{class:'it'},el('label',{style:'display:flex;align-items:flex-start;cursor:pointer;flex:1;min-width:0'},cb,
      el('div',{style:isDone?'text-decoration:line-through;opacity:.6':''},'📚 '+i.title+(i.subject?' · '+i.subject:''),el('small',{},'Due '+fmt(i.due_at)+(i.notes?' · '+i.notes:'')))),
      el('span',{class:'pill'+(isDone?'':d<0?' late':d<=1?' am':'')},isDone?'✓ Done':leftTxt(d))))});
  return c;
}
function notesEl(){
  const c=el('div',{class:'card'},el('h2',{},'Special notes'));
  if(!D.notes.length){c.append(el('div',{class:'empty'},'No special notes right now.'));return c}
  D.notes.forEach(n=>c.append(el('div',{class:'note'+(n.pinned?' pin':'')},el('b',{},(n.pinned?'📌 ':'')+n.title),n.body?el('div',{class:'nb'},n.body):null,
    el('small',{},(n.student_id?'Just for you':'For your class')+' · '+new Date(n.created_at).toLocaleDateString()))));
  return c;
}
function askCard(){
  const hist=[],log=el('div',{class:'log'}),q=el('input',{maxlength:'600',placeholder:'Ask a doubt, or ask for a practice test…'}),b=el('button',{type:'button',class:'pri'},'Ask');
  const add=(t,r)=>{log.append(el('div',{class:'b '+r},t));log.scrollTop=log.scrollHeight};
  const go=async(txt)=>{
    const m=(txt||q.value).trim();if(!m)return;q.value='';add(m,'u');b.disabled=true;const wait=el('div',{class:'b a'},'Thinking…');log.append(wait);
    const r=await sb.functions.invoke('student-assistant',{body:{message:m,conversation:hist}});
    b.disabled=false;wait.remove();let a=r.data&&r.data.answer;
    if(!a){let e='The assistant is busy. Please try again.';try{const c=r.error&&r.error.context;if(c&&c.json){const j=await c.json();if(j&&j.error)e=j.error}}catch(x){}a=e}
    else hist.push({role:'user',text:m},{role:'assistant',text:a});
    add(a,'a')};
  b.onclick=()=>go();q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go()}});
  const sug=el('button',{type:'button',class:'sug',onclick:()=>go('Make a PYQ-style test for my class')},'Make a PYQ-style test for my class');
  return el('div',{class:'card'},el('h2',{},'Photon Assistant'),el('p',{style:'margin-top:0'},'Ask a doubt, get a practice test, or ask about your schedule.'),sug,log,el('div',{class:'ask'},q,b));
}
/* ---------- Fees: pay by UPI, the academy confirms (the website never holds money) ---------- */
const feeInr=p=>'₹'+(Number(p||0)/100).toLocaleString('en-IN',{minimumFractionDigits:Number(p)%100?2:0,maximumFractionDigits:2});
const feeDmy=s=>new Date(String(s).length===10?s+'T00:00:00':s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
function feeEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function feeErrText(e){const m=(e&&e.message)||'';return /Not allowed|row-level|permission/i.test(m)?'You are not allowed to do that.':(m||'Something went wrong. Please try again.')}
async function feeReceipt(id){
  const w=window.open('','_blank');
  try{
    const r=await sb.rpc('get_fee_receipt',{p_payment_id:id});if(r.error)throw r.error;const d=r.data,e=feeEsc;
    const row=(k,v)=>v?'<tr><td style="color:#555;padding:6px 0;width:42%">'+e(k)+'</td><td style="padding:6px 0;font-weight:600">'+e(v)+'</td></tr>':'';
    w.document.write('<!doctype html><meta charset="utf-8"><title>Receipt '+e(d.receipt_no)+'</title><body style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:24px auto;padding:0 18px;color:#111"><h2 style="margin:0">'+e(d.academy_name)+'</h2><p style="margin:2px 0 18px;color:#555">Fee receipt</p><table style="width:100%;border-collapse:collapse;font-size:15px">'+row('Receipt no.',d.receipt_no)+row('Date',feeDmy(d.paid_on))+row('Student',d.student_name)+row('Class',d.class_name?'Class '+d.class_name+(d.board?' '+d.board:'')+(d.division?' '+d.division:''):'')+row('Parent',d.parent_name)+row('For',d.fee_title)+row('Paid by',String(d.method||'').toUpperCase())+row('Reference',d.utr)+'</table><p style="font-size:26px;font-weight:800;margin:20px 0 6px">'+e(feeInr(d.amount_paise))+'</p><p style="color:#555;margin:0">Received with thanks.</p>'+(d.footer?'<p style="color:#555;font-size:13px;margin-top:22px">'+e(d.footer)+'</p>':'')+'<p style="margin-top:26px"><button onclick="window.print()" style="padding:9px 18px">Print / Save as PDF</button></p></body>');w.document.close();
  }catch(x){if(w)w.close();alert(feeErrText(x))}
}
function feeQr(text,target){
  const draw=()=>{try{const q=window.qrcode(0,'M');q.addData(text);q.make();target.innerHTML=q.createSvgTag({cellSize:5,margin:2,scalable:true})}catch(x){target.textContent=''}};
  if(window.qrcode)return draw();
  const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';s.onload=draw;s.onerror=()=>{target.textContent=''};document.head.append(s);
}
function feePayDialog(due,avail,info,done){
  const dlg=el('dialog',{class:'fee-dlg'}),amt=el('input',{type:'number',min:'1',max:String(avail/100),step:'1',value:String(avail/100),inputmode:'decimal'});
  const link=el('a',{class:'pri fee-upi',href:'#'},'Open UPI app and pay'),qr=el('div',{class:'fee-qr'}),err=el('div',{class:'fee-err'});
  const utr=el('input',{type:'text',maxlength:'30',placeholder:'e.g. 412345678901',autocomplete:'off',autocapitalize:'characters'}),file=el('input',{type:'file',accept:'image/png,image/jpeg,image/webp,application/pdf'});
  const submit=el('button',{type:'button',class:'pri'},'Submit for confirmation');
  const cur=()=>{const p=Math.round(Number(amt.value)*100);return Number.isFinite(p)&&p>=100&&p<=avail?p:null};
  const upiUrl=p=>'upi://pay?pa='+encodeURIComponent(info.upi_id)+'&pn='+encodeURIComponent(info.payee_name||info.academy_name||'')+'&am='+(p/100).toFixed(2)+'&cu=INR&tn='+encodeURIComponent(('Fee '+due.title).slice(0,40));
  const refresh=()=>{const p=cur();if(!p){link.removeAttribute('href');link.style.opacity='.5';qr.textContent='';return}link.style.opacity='1';const u=upiUrl(p);link.href=u;feeQr(u,qr)};
  amt.addEventListener('input',refresh);
  const copy=el('button',{type:'button',class:'g',onclick:()=>{navigator.clipboard&&navigator.clipboard.writeText(info.upi_id);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',1500)}},'Copy');
  submit.onclick=async()=>{
    err.textContent='';const p=cur(),u=utr.value.trim().toUpperCase();
    if(!p){err.textContent='Enter an amount up to '+feeInr(avail)+'.';return}
    if(!/^[A-Z0-9]{8,30}$/.test(u)){err.textContent='Enter the reference number (UTR) shown in your payment app after paying.';return}
    const f=file.files[0];if(f&&f.size>3145728){err.textContent='The screenshot is bigger than 3 MB. Choose a smaller one.';return}
    submit.disabled=true;submit.textContent='Submitting…';
    try{
      let path=null;
      if(f){const ext=((f.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'')||'png').slice(0,5);path=UID+'/'+crypto.randomUUID()+'.'+ext;const up=await sb.storage.from('fee-proofs').upload(path,f,{upsert:false,contentType:f.type||undefined});if(up.error)throw new Error('The screenshot could not be uploaded. Remove it and try again.')}
      const r=await sb.rpc('submit_fee_payment',{p_due_id:due.id,p_amount_paise:p,p_utr:u,p_screenshot_path:path});if(r.error)throw r.error;
      try{sb.functions.invoke('notify-fee',{body:{payment_id:r.data}})}catch(x){}
      dlg.close();dlg.remove();done('Submitted. The academy will confirm your payment soon.');
    }catch(x){err.textContent=feeErrText(x);submit.disabled=false;submit.textContent='Submit for confirmation'}
  };
  dlg.append(el('h3',{},'Pay '+due.title),
    el('label',{},'Amount (₹)',amt),
    el('div',{class:'fee-payee'},el('div',{class:'fee-small'},'Pay only to this account'),el('b',{},info.payee_name||info.academy_name||''),el('div',{class:'fee-upiid'},info.upi_id,copy)),
    link,qr,
    el('p',{class:'fee-small'},'On a computer, scan the QR code with any UPI app. Check that the name shown in your app matches the name above before you pay. Never share your UPI PIN or an OTP with anyone.'),
    el('h4',{},'After you have paid'),
    el('label',{},'Reference number (UTR) from your payment app',utr),
    el('label',{},'Screenshot of the payment (optional)',file),
    err,submit,
    el('button',{type:'button',class:'g fee-close',onclick:()=>{dlg.close();dlg.remove()}},'Close'));
  dlg.addEventListener('cancel',()=>dlg.remove());
  document.body.append(dlg);dlg.showModal();refresh();
}
function feesCard(){
  const box=el('div',{class:'card fee-card'},el('h2',{},'Fees'),el('div',{class:'empty'},'Loading…'));
  feeLoad(box,'');return box;
}
async function feeLoad(box,flash){
  const [d,p,i]=await Promise.all([
    sb.from('fee_dues').select('id,title,amount_paise,due_date,status,note').order('due_date',{ascending:true}).limit(200),
    sb.from('fee_payments').select('id,due_id,amount_paise,status,review_note,receipt_no,submitted_at,reviewed_at').order('submitted_at',{ascending:false}).limit(300),
    sb.rpc('get_fee_pay_info')]);
  if(d.error||p.error){box.replaceChildren(el('h2',{},'Fees'),el('div',{class:'empty'},'Fees could not be loaded right now. Please try again later.'));return}
  const info=(i.data&&i.data[0])||{},dues=d.data||[],pays=p.data||[],today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  const sum=(id,st)=>pays.filter(x=>x.due_id===id&&x.status===st).reduce((a,x)=>a+x.amount_paise,0);
  const open=dues.filter(x=>x.status==='open').map(x=>({...x,paid:sum(x.id,'verified'),wait:sum(x.id,'submitted')}));
  const bal=open.reduce((a,x)=>a+x.amount_paise-x.paid,0),late=open.some(x=>x.due_date<today);
  const kids=[el('h2',{},'Fees')];
  if(flash)kids.push(el('div',{class:'fee-ok'},flash));
  if(!dues.length){kids.push(el('div',{class:'empty'},'No fees have been added for you yet.'))}
  else{
    kids.push(el('div',{class:'fee-sum'},el('div',{},el('div',{class:'fee-small'},'Balance to pay'),el('div',{class:'fee-big'},feeInr(bal))),late?el('span',{class:'pill late'},'Overdue'):(bal?null:el('span',{class:'pill'},'All paid'))));
    if(!info.upi_id&&open.length)kids.push(el('div',{class:'fee-note'},'Online payment is not switched on yet. Please pay at the academy.'));
    open.forEach(x=>{
      const b=x.amount_paise-x.paid,avail=b-x.wait,isLate=x.due_date<today;
      const rej=pays.find(y=>y.due_id===x.id&&y.status==='rejected'&&Date.now()-new Date(y.reviewed_at||y.submitted_at)<14*864e5);
      kids.push(el('div',{class:'fee-row'},
        el('div',{},el('b',{},x.title),el('div',{class:'fee-small'},'Due '+feeDmy(x.due_date)+(x.paid?' · paid '+feeInr(x.paid)+' of '+feeInr(x.amount_paise):'')),
          x.wait?el('div',{class:'fee-wait'},feeInr(x.wait)+' submitted, waiting for the academy to confirm'):null,
          rej?el('div',{class:'fee-rej'},'A payment of '+feeInr(rej.amount_paise)+' was not accepted'+(rej.review_note?': '+rej.review_note:'')+'. Please check and try again.'):null),
        el('div',{class:'fee-act'},el('div',{class:'fee-amt'+(isLate?' late':'')},feeInr(b)),isLate?el('span',{class:'pill late'},'Overdue'):null,
          (avail>=100&&info.upi_id)?el('button',{type:'button',class:'fee-pay',onclick:()=>feePayDialog(x,avail,info,m=>feeLoad(box,m))},'Pay'):null)));
    });
    const paid=pays.filter(x=>x.status==='verified');
    if(paid.length){kids.push(el('h4',{class:'fee-h'},'Payments received'));paid.slice(0,15).forEach(x=>kids.push(el('div',{class:'fee-row fee-done'},el('div',{},el('b',{},feeInr(x.amount_paise)),el('div',{class:'fee-small'},feeDmy(x.reviewed_at||x.submitted_at)+' · Receipt '+x.receipt_no)),el('button',{type:'button',class:'g',onclick:()=>feeReceipt(x.id)},'Receipt'))))}
  }
  box.replaceChildren(...kids);
}
async function loadAll(){
  const since=new Date(Date.now()-14*864e5).toISOString(),chFrom=ymd(new Date(Date.now()-7*864e5));
  const [a,b,c,d,e]=await Promise.all([
    sb.from('schedule_items').select('id,kind,title,subject,due_at,notes,created_at').gte('due_at',since).order('due_at',{ascending:true}).limit(300),
    sb.from('class_timetable').select('weekday,start_time,end_time,subject,teacher,room').limit(300),
    sb.from('student_notes').select('title,body,pinned,student_id,created_at').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(60),
    sb.from('timetable_changes').select('on_date,kind,orig_start_time,start_time,end_time,subject,teacher,room,note').gte('on_date',chFrom).limit(300),
    sb.from('schedule_done').select('item_id').limit(1000)]);
  if(a.error||b.error||c.error)return null;
  return {items:a.data||[],tt:b.data||[],notes:c.data||[],ch:d.error?[]:(d.data||[]),done:new Set((e.error?[]:(e.data||[])).map(x=>x.item_id))};
}
let editBtnEl=null;
function repaint(){
  C.hero.replaceChildren(heroEl(editBtnEl));C.cal.replaceChildren(calEl());C.tests.replaceChildren(testsEl());
  C.week.replaceChildren(weekEl());C.hw.replaceChildren(hwEl());C.notes.replaceChildren(notesEl());tick();
}
async function refresh(){if(UID&&STREAK.today&&STREAK.today!==istToday())await recordVisit();const d=await loadAll();if(d){D=d;if(C)repaint()}}

/* ---------- after login ---------- */
async function teacherDesk(session,data){
  const uid=session.user.id,pad=n=>String(n).padStart(2,'0');
  const localIn=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
  const [cl,st]=await Promise.all([sb.from('teacher_classes').select('class_name,board,division').eq('teacher_id',uid).order('class_name'),sb.rpc('teacher_students')]);
  const mine=cl.data||[],students=(st&&st.data)||[];
  const scopes=[],seen=new Set();
  const addScope=(c,b,d)=>{const k=c+'|'+b+'|'+d;if(seen.has(k))return;seen.add(k);scopes.push({c,b,d,label:'Class '+c+(b?' · '+b:' · all boards')+(d?' · Division '+d:' · all divisions')})};
  mine.forEach(m=>{const bs=m.board?[m.board]:['','CBSE','ICSE','GSEB'],ds=m.division?[m.division]:['','A','B','C'];bs.forEach(b=>ds.forEach(d=>addScope(m.class_name,b,d)))});
  const urls={},paths=students.map(x=>x.photo_path).filter(Boolean);
  if(paths.length){try{const r=await sb.storage.from('student-photos').createSignedUrls(paths,3600);(r.data||[]).forEach(x=>{if(x.signedUrl)urls[x.path]=x.signedUrl})}catch(e){}}
  const field=(l,e)=>el('label',{style:'display:block;margin:10px 0'},el('span',{style:'display:block;font-size:13px;color:var(--mu);margin-bottom:5px'},l),e);
  const say=(box,t,ok)=>{box.textContent=t;box.className='msg '+(ok?'ok':'bad')};
  const scopeSel=()=>el('select',{},...scopes.map((x,i)=>el('option',{value:String(i)},x.label)));
  const names=new Map(students.map(x=>[x.id,x.display_name]));
  const hero=el('div',{class:'top'},el('div',{class:'who'},el('div',{class:'ph'},(data.display_name||'?').trim().charAt(0).toUpperCase()),
    el('div',{},el('h1',{},data.display_name||''),el('div',{},el('span',{class:'chip',style:'color:#ffc46b'},'Teacher Desk'),...mine.map(m=>el('span',{class:'chip'},'Class '+m.class_name+(m.board?' · '+m.board:'')+(m.division?' · '+m.division:'')))))));
  if(!scopes.length){show(el('div',{class:'page'},hero,el('div',{class:'card'},el('h2',{},'No classes yet'),el('p',{},'The academy has not given you any classes yet. Ask the admin to add them, then reload this page.'))));return}

  /* students */
  const sq=el('input',{type:'search',placeholder:'Search students…'}),ss=el('select',{},el('option',{value:''},'All my students'),...[...new Set(students.map(x=>x.class_name+'|'+(x.board||'')+'|'+(x.division||'')))].sort().map(k=>{const [c,b,d]=k.split('|');return el('option',{value:k},'Class '+c+(b?' · '+b:'')+(d?' · '+d:''))}));
  const grid=el('div',{class:'tgrid'});
  const paintStu=()=>{const t=sq.value.trim().toLowerCase();const rows=students.filter(x=>(!ss.value||x.class_name+'|'+(x.board||'')+'|'+(x.division||'')===ss.value)&&(!t||(x.display_name||'').toLowerCase().includes(t)));
    grid.replaceChildren(...(rows.length?rows.map(x=>el('div',{class:'sc'},urls[x.photo_path]?el('img',{class:'sph',src:urls[x.photo_path],alt:''}):el('div',{class:'sph'},(x.display_name||'?').charAt(0).toUpperCase()),
      el('div',{},el('b',{},x.display_name||''),el('small',{},'Class '+x.class_name+(x.board?' · '+x.board:'')+(x.division?' · '+x.division:'')),x.school?el('small',{},x.school):null,
        el('small',{},'Parent: '+(x.parent_name||'-')+' · ',x.parent_phone?el('a',{href:'tel:'+x.parent_phone.replace(/[^+\d]/g,'')},x.parent_phone):null)))):[el('div',{class:'empty'},'No students match.')]))};
  sq.oninput=paintStu;ss.onchange=paintStu;paintStu();
  const stuCard=el('div',{class:'card'},el('h2',{},'My students ('+students.length+')'),el('div',{style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:10px'},sq,ss),grid);

  /* assign homework / test */
  const itemsBox=el('div',{class:'card'});
  async function loadItems(){
    const {data:rows}=await sb.from('schedule_items').select('*').eq('created_by',uid).order('due_at',{ascending:false}).limit(60);
    itemsBox.replaceChildren(el('h2',{},'What I assigned'),...((rows||[]).length?rows.map(it=>el('div',{class:'it'},el('div',{},(it.kind==='test'?'📝 ':'📚 ')+it.title+(it.subject?' · '+it.subject:''),
      el('small',{},fmt(it.due_at)+' · '+(it.student_id?'For '+(names.get(it.student_id)||'a student'):'Class '+it.class_name+(it.board?' · '+it.board:'')+(it.division?' · '+it.division:'')))),
      el('button',{type:'button',class:'g',style:'margin:0;width:auto;padding:6px 12px',onclick:async()=>{if(!confirm('Delete "'+it.title+'"?'))return;const r=await sb.from('schedule_items').delete().eq('id',it.id);if(!r.error)loadItems()}},'Delete'))):[el('div',{class:'empty'},'Nothing assigned yet.')]));
  }
  const kind=el('select',{},el('option',{value:'homework'},'Homework'),el('option',{value:'test'},'Test')),title=el('input',{maxlength:'120',placeholder:'e.g. Exercise 4.2'}),subject=el('input',{maxlength:'60',placeholder:'Subject (optional)'}),due=el('input',{type:'datetime-local'}),notes=el('textarea',{maxlength:'500',rows:'2',placeholder:'Optional notes'});
  const who=el('select',{},el('option',{value:'class'},'A class'),el('option',{value:'student'},'Specific students')),sc=scopeSel(),scF=field('Class',sc);
  const checks=students.map(x=>{const cb=el('input',{type:'checkbox',style:'width:20px;min-height:0;padding:0;margin-right:8px;accent-color:#4fd6e8'});cb.value=x.id;return {x,cb,row:el('label',{style:'display:flex;align-items:center;padding:4px 0'},cb,(x.display_name||'')+' (Class '+x.class_name+(x.division||'')+')')}});
  const stuBox=el('div',{style:'display:none;max-height:160px;overflow:auto;border:1px solid var(--ln);border-radius:9px;padding:6px 10px'},...checks.map(c=>c.row));
  who.onchange=()=>{scF.style.display=who.value==='class'?'':'none';stuBox.style.display=who.value==='student'?'block':'none'};
  const aMsg=el('div',{class:'msg'}),aBtn=el('button',{type:'button',class:'pri'},'Assign');
  aBtn.onclick=async()=>{
    const t=title.value.trim();if(t.length<2)return say(aMsg,'Enter a title.');if(!due.value)return say(aMsg,'Pick the due date and time.');
    const base={kind:kind.value,title:t,subject:subject.value.trim()||null,due_at:new Date(due.value).toISOString(),notes:notes.value.trim()||null,created_by:uid};let rows;
    if(who.value==='class'){const x=scopes[+sc.value];rows=[{...base,class_name:x.c,board:x.b||null,division:x.d||null}]}
    else{const pick=checks.filter(c=>c.cb.checked).map(c=>c.x);if(!pick.length)return say(aMsg,'Tick at least one student.');rows=pick.map(x=>({...base,student_id:x.id,class_name:x.class_name||'any',division:null}))}
    aBtn.disabled=true;const r=await sb.from('schedule_items').insert(rows);aBtn.disabled=false;
    if(r.error)return say(aMsg,'Could not assign. Check the class and try again.');
    say(aMsg,'Assigned.',true);title.value='';notes.value='';loadItems()};
  const assignCard=el('div',{class:'card'},el('h2',{},'Assign homework or a test'),field('Type',kind),field('Title',title),field('Subject',subject),field('Due date and time',due),field('Notes',notes),field('Assign to',who),scF,stuBox,aBtn,aMsg);

  /* notes */
  const notesBox=el('div',{class:'card'});
  async function loadNotes(){
    const {data:rows}=await sb.from('student_notes').select('*').eq('created_by',uid).order('created_at',{ascending:false}).limit(40);
    notesBox.replaceChildren(el('h2',{},'My special notes'),...((rows||[]).length?rows.map(n=>el('div',{class:'it'},el('div',{},(n.pinned?'📌 ':'')+n.title,el('small',{},(n.student_id?'For '+(names.get(n.student_id)||'a student'):'Class '+n.class_name+(n.division?' · '+n.division:''))+(n.body?' · '+n.body:''))),
      el('button',{type:'button',class:'g',style:'margin:0;width:auto;padding:6px 12px',onclick:async()=>{if(!confirm('Delete this note?'))return;const r=await sb.from('student_notes').delete().eq('id',n.id);if(!r.error)loadNotes()}},'Delete'))):[el('div',{class:'empty'},'No notes yet.')]));
  }
  const nTitle=el('input',{maxlength:'120',placeholder:'e.g. Bring calculator on Friday'}),nBody=el('textarea',{maxlength:'2000',rows:'2',placeholder:'Details (optional)'}),nPin=el('input',{type:'checkbox',style:'width:20px;min-height:0;padding:0;margin-right:8px;accent-color:#4fd6e8'});
  const nWho=el('select',{},el('option',{value:'class'},'A class'),el('option',{value:'student'},'One student')),nSc=scopeSel(),nScF=field('Class',nSc),nSt=el('select',{},...students.map(x=>el('option',{value:x.id},(x.display_name||'')+' (Class '+x.class_name+(x.division||'')+')'))),nStF=field('Student',nSt);nStF.style.display='none';
  nWho.onchange=()=>{nScF.style.display=nWho.value==='class'?'':'none';nStF.style.display=nWho.value==='student'?'':'none'};
  const nMsg=el('div',{class:'msg'}),nBtn=el('button',{type:'button',class:'pri'},'Add note');
  nBtn.onclick=async()=>{
    if(nTitle.value.trim().length<2)return say(nMsg,'Enter a title.');
    const row={title:nTitle.value.trim(),body:nBody.value.trim()||null,pinned:nPin.checked,created_by:uid};
    if(nWho.value==='class'){const x=scopes[+nSc.value];row.class_name=x.c;row.board=x.b||null;row.division=x.d||null}else{if(!nSt.value)return say(nMsg,'No student to choose.');const x=students.find(y=>y.id===nSt.value);row.student_id=nSt.value;row.class_name=(x&&x.class_name)||'any'}
    nBtn.disabled=true;const r=await sb.from('student_notes').insert(row);nBtn.disabled=false;
    if(r.error)return say(nMsg,'Could not add the note.');say(nMsg,'Added.',true);nTitle.value='';nBody.value='';loadNotes()};
  const noteForm=el('div',{class:'card'},el('h2',{},'Add a special note'),field('For',nWho),nScF,nStF,field('Title',nTitle),field('Details',nBody),el('label',{style:'display:flex;align-items:center;margin:8px 0'},nPin,'Pin to the top'),nBtn,nMsg);

  /* change one day */
  const chBox=el('div',{class:'card'});
  const chSc=scopeSel(),chDate=el('input',{type:'date'}),chNote=el('input',{maxlength:'200',placeholder:'Note for students (optional)'}),chList=el('div'),chMsg=el('div',{class:'msg'});chDate.value=ymd(new Date());
  async function loadDay(){
    const x=scopes[+chSc.value];if(!x||!chDate.value){chList.replaceChildren();return}
    const wd=wdn(new Date(chDate.value+'T12:00:00'));
    let q=sb.from('class_timetable').select('*').eq('class_name',x.c).eq('weekday',wd).order('start_time');q=x.d?q.or('division.is.null,division.eq.'+x.d):q.is('division',null);q=x.b?q.or('board.is.null,board.eq.'+x.b):q.is('board',null);
    let q2=sb.from('timetable_changes').select('*').eq('class_name',x.c).eq('on_date',chDate.value);q2=x.d?q2.eq('division',x.d):q2.is('division',null);q2=x.b?q2.eq('board',x.b):q2.is('board',null);
    const [{data:base},{data:ch}]=await Promise.all([q,q2]);
    const put=async(row)=>{const r=await sb.from('timetable_changes').insert({class_name:x.c,board:x.b||null,division:x.d||null,on_date:chDate.value,created_by:uid,...row});if(r.error)return say(chMsg,'Could not save that change.');say(chMsg,'Saved. Students see it right away.',true);loadDay()};
    const undo=async(c)=>{await sb.from('timetable_changes').delete().eq('id',c.id);loadDay()};
    const form=(init,label,fn)=>{const sub=el('input',{maxlength:'60',placeholder:'Subject'}),s1=el('input',{type:'time'}),e1=el('input',{type:'time'}),rm=el('input',{maxlength:'30',placeholder:'Room (optional)'}),go=el('button',{type:'button',class:'pri',style:'margin:0'},label);
      sub.value=init.subject||'';s1.value=(init.start_time||'').slice(0,5);e1.value=(init.end_time||'').slice(0,5);rm.value=init.room||'';
      go.onclick=()=>{if(sub.value.trim().length<2||!s1.value||!e1.value||e1.value<=s1.value)return say(chMsg,'Enter a subject and a start time before the end time.');fn({subject:sub.value.trim(),start_time:s1.value+':00',end_time:e1.value+':00',room:rm.value.trim()||null,note:chNote.value.trim()||null})};
      return el('div',{style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:8px'},sub,s1,e1,rm,go)};
    const slot=b=>{const mine2=(ch||[]).filter(c=>c.orig_start_time&&c.orig_start_time.slice(0,5)===b.start_time.slice(0,5));const holder=el('div',{class:'it',style:'flex-wrap:wrap'});
      holder.append(el('div',{},t12(b.start_time)+' – '+t12(b.end_time)+' · '+b.subject,...mine2.map(c=>el('small',{style:'color:var(--am)'},(c.kind==='cancelled'?'✕ Cancelled':'↻ Changed to '+c.subject)+(c.note?' · '+c.note:'')))),
        el('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},...mine2.filter(c=>c.created_by===uid).map(c=>el('button',{type:'button',class:'g',style:'margin:0;width:auto;padding:6px 12px',onclick:()=>undo(c)},'Undo')),
          mine2.length?null:el('button',{type:'button',class:'g',style:'margin:0;width:auto;padding:6px 12px',onclick:()=>put({kind:'cancelled',orig_start_time:b.start_time,subject:b.subject,note:chNote.value.trim()||null})},'Cancel'),
          mine2.length?null:el('button',{type:'button',class:'g',style:'margin:0;width:auto;padding:6px 12px',onclick:()=>holder.append(form(b,'Save change',v=>put({kind:'changed',orig_start_time:b.start_time,...v})))},'Change')));return holder};
    const extras=(ch||[]).filter(c=>c.kind==='extra');
    chList.replaceChildren(...((base||[]).length?base.map(slot):[el('div',{class:'empty'},'No classes in the weekly timetable for this day.')]),
      ...extras.map(c=>el('div',{class:'it'},el('div',{},'＋ Extra: '+t12(c.start_time)+' – '+t12(c.end_time)+' · '+c.subject),c.created_by===uid?el('button',{type:'button',class:'g',style:'margin:0;width:auto;padding:6px 12px',onclick:()=>undo(c)},'Remove'):null)),
      el('details',{style:'margin-top:10px'},el('summary',{style:'cursor:pointer;color:var(--ac)'},'＋ Add an extra class'),form({},'Add extra class',v=>put({kind:'extra',...v}))));
  }
  chSc.onchange=loadDay;chDate.onchange=loadDay;
  chBox.append(el('h2',{},'Change a class for one day'),el('p',{style:'margin-top:0'},'Cancel, change or add a class on one date. The weekly timetable stays as it is.'),
    el('div',{style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px'},chSc,chDate),field('Note for students (used by the next button)',chNote),chList,chMsg);

  show(el('div',{class:'page'},hero,stuCard,el('div',{class:'cols2'},assignCard,itemsBox),el('div',{class:'cols2'},noteForm,notesBox),chBox));
  loadItems();loadNotes();loadDay();
}
let claimUid=null;
async function status(session){
  const uid=session.user.id;setOut(true);timers.forEach(clearInterval);timers=[];
  if(claimUid!==uid){claimUid=uid;try{await sb.rpc('claim_my_roster')}catch(e){}}
  const {data,error}=await sb.from('profiles').select('display_name,role,student_status,class_name,division,board,school,dob,phone,parent_name,parent_phone,address,photo_path').eq('id',uid).single();
  if(error||!data){show(el('div',{class:'box'},el('h1',{},'Something went wrong'),el('p',{},'Please try again in a moment.')));return}
  P=data;UID=uid;const s=data.student_status;
  if(data.role==='teacher'){await teacherDesk(session,data);return}
  if(s==='rejected'){show(el('div',{class:'box'},el('h1',{},'Account not approved'),el('p',{},'The academy could not approve this account. Please contact the academy if you think this is a mistake.')));return}
  const um=session.user.user_metadata||{},gname=String(um.full_name||um.name||'').trim().slice(0,60);
  if(s!=='approved'&&gname&&(!data.display_name||!/\s/.test(data.display_name)))data.display_name=gname;
  const done=REQ.every(k=>data[k])&&data.display_name;
  if(s!=='approved'){
    show(el('div',{class:'box'},done?el('h1',{},'Waiting for approval'):el('h1',{},'Complete your profile'),
      el('p',{},done?'Thanks! Your details are with the academy. You can still update them below.':'The academy needs these details and a photo to verify you before approving your account.'),
      profileForm(session,data,()=>status(session))));return}
  photoUrl=null;
  if(data.photo_path){const r=await sb.storage.from('student-photos').createSignedUrl(data.photo_path,3600);if(r.data&&r.data.signedUrl)photoUrl=r.data.signedUrl}
  const d0=await loadAll();if(d0)D=d0;await recordVisit();
  const editCard=el('div',{class:'card',style:'display:none;max-width:620px'},el('h2',{},'Edit profile'),profileForm(session,data,()=>status(session)));
  editBtnEl=el('button',{class:'g',type:'button',onclick:()=>{editCard.style.display=editCard.style.display==='none'?'block':'none'}},'Edit profile');
  C={hero:el('div'),cal:el('div',{class:'card'}),tests:el('div'),week:el('div'),hw:el('div'),notes:el('div')};
  show(el('div',{class:'page'},C.hero,feesCard(),editCard,el('div',{class:'cols'},C.cal,C.tests),C.week,el('div',{class:'cols2'},C.hw,C.notes),askCard()));
  repaint();
  timers.push(setInterval(tick,1000),setInterval(refresh,45000));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
}
async function boot(){const {data:{session}}=await sb.auth.getSession();session?status(session):form()}
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_IN')setTimeout(boot,0)});
boot();

};
})();
