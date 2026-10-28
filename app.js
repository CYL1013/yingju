
const PHASES={submit:"投稿中",vote:"投票中",results:"成果發表"};
const T2=["A","B"];
const S={code:"",st:null,tab:null,busy:{},noteDraft:{},saved:{},draft:null,draftDirty:false,resultRound:null,working:false,results:null,resView:"events",portfolio:null,boardYear:null};
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let toastT;function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3500)}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function shuffled(arr,seed){const a=arr.slice();let x=hash(seed)||1;for(let i=a.length-1;i>0;i--){x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;const j=x%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function cfg(){return S.st&&S.st.cfg}
function themeDesc(T,c=cfg()){return c?(T==="A"?c.descA:c.descB)||"":""}
function themeName(T,c=cfg()){return c?(T==="A"?c.themeA:c.themeB)||("主題 "+T):"主題 "+T}
function submitOpen(c=cfg()){return !!c&&!!c.round&&c.phase==="submit"&&(!c.deadlineAt||Date.now()<c.deadlineAt)}
function fmtDate(ms){return new Date(ms).toLocaleString("zh-TW",{month:"numeric",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false})}
function timeLeft(ms){const d=ms-Date.now();if(d<=0)return null;const h=Math.floor(d/3600000),dd=Math.floor(h/24);return dd>=1?`還剩 ${dd} 天 ${h%24} 小時`:h>=1?`還剩 ${h} 小時`:`還剩 ${Math.max(1,Math.ceil(d/60000))} 分鐘`}
function toLocalInput(ms){if(!ms)return"";const d=new Date(ms);return new Date(ms-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function nextMonth(){const d=new Date();d.setMonth(d.getMonth()+1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}
function img(url,alt){return `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer">`}
function lsGet(k){try{return localStorage.getItem(k)||""}catch(_){return""}}
function lsSet(k,v){try{v?localStorage.setItem(k,v):localStorage.removeItem(k)}catch(_){}}

/* ---------- server ---------- */
const API=String(window.YINGJU_API||"").trim();
function call(fn,...args){
  if(!API)return new Promise((res,rej)=>google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn](...args));
  return (async()=>{
    let r;
    try{r=await fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({fn,args}),redirect:"follow"})}
    catch(e){throw new Error("連線失敗，請檢查網路後再試")}
    let j;
    try{j=await r.json()}catch(e){throw new Error("伺服器回應異常，請稍後再試")}
    if(!j||!j.ok)throw new Error((j&&j.error)||"伺服器錯誤");
    return j.data;
  })();
}
function errMsg(e){return String((e&&e.message)||e||"錯誤").replace(/^(Exception|Error):\s*/,"")}
function apply(st){
  if(API)st.appUrl=location.href.split(/[?#]/)[0];
  const prev=S.st&&S.st.cfg.round;S.st=st;
  if(prev!==st.cfg.round){S.draft=null;S.draftDirty=false}
  if(!S.draftDirty)S.draft=st.myVote?{A:[...(st.myVote.A||[])],B:[...(st.myVote.B||[])],C:Object.assign({},st.myVote.C||{})}:null;
  if(!st.codeOk&&S.code){S.code="";lsSet("pc_code","")}
  const tabs=allowedTabs();if(!S.tab||!tabs.includes(S.tab))S.tab=defaultTab();
  render();
}
function showLoadError(msg){
  if(S.st){toast("讀取失敗："+msg);return}
  $("#main").innerHTML=`<div class="notice warn"><h3>連不上活動資料</h3><p class="small">錯誤訊息：<span class="mono">${esc(msg)}</span></p>
    <p class="small">常見原因：瀏覽器同時登入多個 Google 帳號（請改用無痕視窗開啟）、部署時「存取權」不是「所有人」，或還沒執行 setup。</p>
    <div><button class="btn primary" id="retry">重新載入</button></div></div>`;
  $("#retry").onclick=()=>{$("#main").innerHTML=`<div class="notice">正在連線，請稍候。</div>`;refresh()};
}
async function refresh(){
  const slow=S.st?null:setTimeout(()=>{if(!S.st)$("#main").innerHTML=`<div class="notice">連線比較久，請再稍候…<p class="small">超過 30 秒還沒出現的話，請改用無痕視窗開啟，或確認瀏覽器只登入一個 Google 帳號。</p></div>`},12000);
  try{
    if(!S.code&&S.pendingCode){await checkPending(false);if(S.st)return}
    const st=await call("getState",S.code);if(!st||!st.cfg)throw new Error("伺服器沒有回傳資料");apply(st)}
  catch(e){showLoadError(errMsg(e))}
  finally{clearTimeout(slow)}
}
async function run(fn,args,okMsg){
  if(S.working)return;S.working=true;
  try{const st=await call(fn,...args);apply(st);if(okMsg)toast(okMsg);return true}
  catch(e){toast(errMsg(e));return false}
  finally{S.working=false}
}

/* ---------- render ---------- */
function allowedTabs(){const st=S.st;if(!st||!st.codeOk)return["login","results"];const t=["submit","vote","results"];if(st.me.isAdmin)t.push("draw","admin");return t}
function defaultTab(){const st=S.st;if(!st.codeOk)return st.cfg.phase==="results"&&st.resultsCount?"results":"login";if(!st.cfg.round&&st.me.isAdmin)return"admin";return st.cfg.phase==="vote"?"vote":st.cfg.phase==="results"?"results":"submit"}
S.composing=false;
document.addEventListener("compositionstart",()=>{S.composing=true},true);
document.addEventListener("compositionend",()=>{S.composing=false;if(S.pendingRender){S.pendingRender=false;setTimeout(render,0)}},true);
function render(){
  if(S.composing){S.pendingRender=true;return}
  renderHead();renderTabs();
  const m=$("#main");if(!S.st){m.innerHTML=`<div class="notice">正在載入活動資料…</div>`;return}
  const ae=document.activeElement,keep=ae&&ae.id,val=keep&&ae.value,sel=keep&&("selectionStart" in ae)?[ae.selectionStart,ae.selectionEnd]:null;
  const views={login:[loginView,bindLogin],submit:[submitView,bindSubmit],vote:[voteView,bindVote],results:[resultsView,bindResults],draw:[drawView,bindDraw],admin:[adminView,bindAdmin]};
  const [v,b]=views[S.tab]||views.login;
  if(!cfg().round&&!["admin","login","results","draw"].includes(S.tab)){m.innerHTML=`<div class="notice"><h3>主辦人還沒設定本期活動</h3><p>設定好主題後，這裡會開放投稿。</p></div>`;return}
  m.innerHTML=v();b();
  if(keep){const el=document.getElementById(keep);if(el){el.focus();if(val!=null&&(el.type==="text"||el.tagName==="TEXTAREA"))el.value=val;if(sel)try{el.setSelectionRange(sel[0],sel[1])}catch(_){}}}
}
function renderHead(){
  const st=S.st,c=cfg();
  const top=`<div class="topbar"><span class="brand">影聚</span>${st&&st.codeOk?`<span class="who-am-i">${esc(st.me.name)}${st.me.isAdmin?"・主辦人":""}<button class="btn sm" id="logout">登出</button></span>`:""}</div>`;
  if(!c||!c.round){$("#head").innerHTML=top+`<div class="head-card"><h1>${st?"尚未開始":"正在載入活動…"}</h1></div>`;bindLogout();return}
  const order=["submit","vote","results"],i=order.indexOf(c.phase);
  const dates=[c.deadlineAt,c.voteDeadlineAt,null];
  const sub=k=>{
    if(k<2)return dates[k]?`截止 ${esc(fmtDate(dates[k]))}`:(k<i?"已結束":"由主辦人切換");
    return c.phase==="results"?"已公布":"投票截止後公布";
  };
  let note="";
  if(c.phase==="submit"&&c.deadlineAt)note=timeLeft(c.deadlineAt)?`投稿截止<b>${timeLeft(c.deadlineAt)}</b>`:`<span class="over">投稿已截止，${c.autoSwitch?"即將自動開放投票":"等待主辦人開放投票"}</span>`;
  else if(c.phase==="vote"&&c.voteDeadlineAt)note=timeLeft(c.voteDeadlineAt)?`投票截止<b>${timeLeft(c.voteDeadlineAt)}</b>`:`<span class="over">投票已截止，${c.autoSwitch?"即將自動公布結果":"等待主辦人公布結果"}</span>`;
  else if(c.phase==="results")note=st.nextOpen?`成果已公布 · 下一期將於<b>${esc(fmtDate(st.nextOpen.at))}</b>開始`:"成果已公布，到「成果」分頁看看吧";
  $("#head").innerHTML=top+`<div class="head-card">
    <div class="eyebrow">${esc(c.round)}</div>
    <h1>${esc(c.title||"影聚")}</h1>
    <div class="theme-cards${activeThemes().length===1?" single":""}">${activeThemes().map(T=>`<div class="tcard"><div class="tl">主題 ${T}</div><div class="tn${(T==="A"?c.themeA:c.themeB)?"":" tbd"}">${esc((T==="A"?c.themeA:c.themeB)||"待公布")}</div>${themeDesc(T)?`<div class="td">${esc(themeDesc(T))}</div>`:""}</div>`).join("")}</div>
    <ol class="progress" aria-label="活動進度">${order.map((p,k)=>`<li class="pstep ${k<i?"done":k===i?"on":""}" ${k===i?'aria-current="step"':""}><span class="dot">${k<i?"✓":k+1}</span><span class="plabel">${["投稿","投票","發表"][k]}</span><span class="pdate">${sub(k)}</span></li>`).join("")}</ol>
    ${note?`<div class="pnote">${note}</div>`:""}
  </div>`;
  bindLogout();
}
function bindLogout(){const lo=$("#logout");if(lo)lo.onclick=()=>{S.code="";S.authMode=null;lsSet("pc_code","");S.tab=null;S.draft=null;S.draftDirty=false;S.noteDraft={};refresh()}}
function userLine(){return `<div class="row small muted">你好，${esc(S.st.me.name)}${S.st.me.isAdmin?"（主辦人）":""}<button class="btn" id="logout" style="padding:3px 10px;font-size:13px">登出</button></div>`}
function setTabsH(){const n=$("#tabs");if(n)document.documentElement.style.setProperty("--tabs-h",n.offsetHeight+"px")}
window.addEventListener("resize",setTabsH);
function renderTabs(){
  if(!S.st){$("#tabs").innerHTML="";return}
  const label={login:"登入",submit:"投稿",vote:"投票",results:"成果",draw:"抽主題",admin:"主辦人"};
  const nAp=(S.st.applicants||[]).length;
  $("#tabs").innerHTML=allowedTabs().map(k=>`<button role="tab" data-tab="${k}" aria-selected="${S.tab===k}">${label[k]}${k==="admin"&&nAp?`<span class="tab-dot" aria-label="${nAp} 筆新成員申請">${nAp}</span>`:""}</button>`).join("");
  $("#tabs").querySelectorAll("button").forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;if(S.tab==="results"){S.results=null;S.portfolio=null}render();
    const n=$("#tabs"),y=n.offsetTop-parseFloat(getComputedStyle(n).top||0);if(window.scrollY>y)window.scrollTo(0,y);
    if(S.tab!=="login")refresh()});
  setTabsH();
}

/* ---------- login ---------- */
function loginView(){
  const st=S.st||{};
  /* 申請已送出，等待審核 */
  if(S.pendingCode&&st.applyStatus){
    const rejected=st.applyStatus==="rejected";
    return `<div class="auth"><div class="auth-card">
      <div class="auth-mark">${rejected?"✕":"…"}</div>
      <h2>${rejected?"申請沒有通過":"申請已送出"}</h2>
      <p class="small muted">${rejected?"主辦人沒有核准這次申請，有問題請直接聯絡主辦人。":`主辦人審核通過後，就能用工號後三碼 <b class="mono">${esc(S.pendingCode)}</b> 登入。<br>這個頁面會自動檢查，通過後直接進入。`}</p>
      <div class="auth-actions">${rejected?"":`<button class="btn primary" id="pd_check">重新檢查</button>`}<button class="btn" id="pd_back">改用其他代碼登入</button></div>
    </div></div>`;
  }
  /* 註冊 */
  if(S.authMode==="register"){
    const r=S.reg||{};
    if(r.confirm){
      return `<div class="auth"><div class="auth-card">
        <h2>確認申請資料</h2>
        <dl class="confirm-list"><div><dt>名字</dt><dd>${esc(r.name)}</dd></div><div><dt>工號</dt><dd class="mono">${esc(r.empId)}</dd></div><div><dt>登入代碼</dt><dd class="mono">${esc(r.empId.slice(1))}</dd></div></dl>
        <p class="small muted">送出後會通知主辦人審核，核准後就能用工號後三碼登入。名字會用在成果發表的署名。</p>
        <div class="auth-actions"><button class="btn" id="rg_edit">返回修改</button><button class="btn primary" id="rg_send">確認送出</button></div>
      </div></div>`;
    }
    return `<div class="auth"><div class="auth-card">
      <h2>註冊新成員</h2>
      <p class="small muted">填好後送給主辦人審核。</p>
      <form id="rf" class="auth-form">
        <label class="field" for="rg_name">名字（發表時的署名）<input type="text" id="rg_name" maxlength="20" autocomplete="name" value="${esc(r.name||"")}" placeholder="例如：王小明"></label>
        <label class="field" for="rg_id">工號<input type="text" id="rg_id" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(r.empId||"")}" placeholder="例如：C123"></label>
        <div class="auth-actions"><button class="btn" type="button" id="rg_cancel">返回登入</button><button class="btn primary" type="submit">下一步</button></div>
      </form>
    </div></div>`;
  }
  /* 登入 */
  return `<div class="auth"><div class="auth-card">
    <h2>登入影聚</h2>
    <p class="small muted">輸入你的個人代碼（工號後三碼）。這台裝置會記住，下次不用再輸入。</p>
    <form id="lf" class="auth-form">
      <label class="field" for="code">個人代碼<input type="text" id="code" inputmode="numeric" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="20" placeholder="例如工號 C123，請輸入 123"></label>
      <div class="auth-actions"><button class="btn primary" type="submit">登入</button><button class="btn" type="button" id="go_reg">註冊新成員</button></div>
    </form>
  </div></div>`;
}
function bindLogin(){
  const lf=$("#lf");if(lf)lf.onsubmit=async e=>{e.preventDefault();const v=$("#code").value.trim();if(!v)return toast("請輸入代碼");
    try{const st=await call("getState",v);
      if(!st.codeOk){
        if(st.applyStatus==="pending"){S.pendingCode=v;lsSet("pc_pending",v);apply(st);return}
        return toast("代碼不正確。新成員請按「註冊新成員」")}
      S.code=v;lsSet("pc_code",v);lsSet("pc_pending","");S.tab=null;apply(st)}catch(err){toast("登入失敗："+errMsg(err))}};
  const gr=$("#go_reg");if(gr)gr.onclick=()=>{S.authMode="register";S.reg={};render()};
  const rc=$("#rg_cancel");if(rc)rc.onclick=()=>{S.authMode=null;render()};
  const rf=$("#rf");if(rf)rf.onsubmit=e=>{e.preventDefault();
    const name=$("#rg_name").value.trim().replace(/\s+/g," "),m=/^\s*[Cc]?\s*(\d{3})\s*$/.exec($("#rg_id").value);
    if(!name)return toast("請填寫名字");
    if(!m)return toast("工號格式是 C 加三碼數字，例如 C123");
    S.reg={name,empId:"C"+m[1],confirm:true};render()};
  const re=$("#rg_edit");if(re)re.onclick=()=>{S.reg.confirm=false;render()};
  const rs=$("#rg_send");if(rs)rs.onclick=async()=>{
    rs.disabled=true;rs.textContent="送出中…";
    try{const r=await call("registerMember",S.reg.name,S.reg.empId,API?location.href.split(/[?#]/)[0]:"");
      S.pendingCode=r.code;lsSet("pc_pending",r.code);S.authMode=null;S.reg=null;
      apply(await call("getState",r.code));toast("申請已送出，主辦人會收到通知")}
    catch(err){toast(errMsg(err));rs.disabled=false;rs.textContent="確認送出"}};
  const pc=$("#pd_check");if(pc)pc.onclick=()=>checkPending(true);
  const pb=$("#pd_back");if(pb)pb.onclick=()=>{S.pendingCode=null;lsSet("pc_pending","");render()};
}
async function checkPending(manual){
  if(!S.pendingCode||S.code)return;
  try{const st=await call("getState",S.pendingCode);
    if(st.codeOk){S.code=S.pendingCode;lsSet("pc_code",S.code);lsSet("pc_pending","");S.pendingCode=null;S.tab=null;apply(st);toast("審核通過，歡迎加入影聚！");return}
    apply(st);if(manual)toast(st.applyStatus==="pending"?"還在審核中":"已更新")}
  catch(e){if(manual)toast(errMsg(e))}
}
S.pendingCode=lsGet("pc_pending")||null;
setInterval(()=>{if(S.pendingCode&&!S.code&&document.visibilityState==="visible")checkPending(false)},30000);

/* ---------- submit ---------- */
function mySlot(T,i){return (S.st.myEntry||[]).find(e=>e.theme===T&&e.slot===i)||null}
function submitView(){
  const c=cfg(),open=submitOpen(),count=(S.st.myEntry||[]).length;
  let h=`<div class="stack"><div class="notice"><p>目前已有 <b class="mono">${S.st.entrants}</b> 位投稿。其他人的作品要到開放投票時才看得到。</p></div>`;
  if(!open)h+=`<div class="notice warn"><b>投稿已截止</b><p class="small">${c.phase==="submit"&&c.deadlineAt?"截止時間 "+esc(fmtDate(c.deadlineAt))+"。":""}下面是你本期送出的作品。</p></div>`;
  h+=`<div class="panel"><div class="row" style="justify-content:space-between"><h2>我的投稿</h2><span class="mono small muted">${count} / ${perTheme()*activeThemes().length} 張</span></div>
    <p class="small muted">每個主題 ${perTheme()} 張，共 ${perTheme()*activeThemes().length} 張。發表時會署名「${esc(S.st.me.name)}」。名字和備註都只會在公布結果時顯示，投票期間大家只看得到照片。</p></div>`;
  for(const T of activeThemes()){
    h+=`<section class="stack" style="gap:10px"><div><h3><span class="mono">${T}</span>　${esc(themeName(T))}</h3>${themeDesc(T)?`<p class="small muted">${esc(themeDesc(T))}</p>`:""}</div><div class="grid big">`;
    for(let i=0;i<perTheme();i++){
      const sl=mySlot(T,i),k=T+i,busy=S.busy[k];
      h+=`<div class="frame">
        ${busy?`<div class="pic empty busy" id="bz_${k}">${esc(busy)}</div>`:sl?`<button class="pic" data-zoom="${esc(sl.url)}" aria-label="放大 ${T}-${i+1}">${img(sized(sl.url,800),T+"-"+(i+1)+" 作品")}</button>`:`<div class="pic empty">${busy?"上傳中…":"尚未上傳"}</div>`}
        <div class="cap"><span class="mono">${T}-${i+1}</span>
        ${open?`<span class="slot-actions"><label class="btn">${busy?"上傳中…":sl?"更換":"選擇照片"}<input type="file" accept="image/jpeg,image/png,image/webp,image/*" id="f${k}" data-t="${T}" data-i="${i}" ${busy?"disabled":""}></label></span>`:""}
        </div>${sl?exifHtml(sl.exif):""}${sl?noteField(k,sl,open):""}</div>`;
    }
    h+=`</div></section>`;
  }
  return h+`</div>`;
}
function noteField(k,sl,open){
  const cur=S.noteDraft[k]??sl.note??"";
  if(!open)return cur?`<div class="note">${esc(cur)}</div>`:"";
  const dirty=S.noteDraft[k]!=null&&S.noteDraft[k]!==(sl.note||"");
  return `<textarea id="n_${k}" data-k="${k}" rows="2" maxlength="150" placeholder="作品備註（選填）：拍攝地點、想法、器材…">${esc(cur)}</textarea>
    <div class="note-bar"><span class="note-status" id="ns_${k}">${noteStatus(k,dirty)}</span><button class="btn sm" id="nb_${k}" data-save="${k}" ${dirty?"":"hidden"}>儲存備註</button></div>`;
}
function noteStatus(k,dirty){
  if(S.noteSaving&&S.noteSaving[k])return "儲存中…";
  if(dirty)return "尚未儲存 · 停止打字 5 秒後自動儲存";
  return S.saved[k]?`已儲存 ${S.saved[k]}`:"";
}
function slotNote(k){const sl=mySlot(k[0],+k[1]);return sl?(sl.note||""):""}
function paintNote(k){
  const dirty=S.noteDraft[k]!=null&&S.noteDraft[k]!==slotNote(k);
  const st=document.getElementById("ns_"+k),bt=document.getElementById("nb_"+k);
  if(st)st.textContent=noteStatus(k,dirty);
  if(bt)bt.hidden=!dirty||!!(S.noteSaving&&S.noteSaving[k]);
}
S.noteTimers={};S.noteSaving={};
function scheduleNote(k){
  clearTimeout(S.noteTimers[k]);
  S.noteTimers[k]=setTimeout(()=>{
    if(S.composing){scheduleNote(k);return}          // 正在選字就再等一下
    saveNote(k);
  },5000);
}
function bindSubmit(){
  document.querySelectorAll("textarea[data-k]").forEach(t=>{
    const k=t.dataset.k;
    t.oninput=()=>{S.noteDraft[k]=t.value;paintNote(k);scheduleNote(k)};
  });
  document.querySelectorAll("[data-save]").forEach(b=>b.onclick=()=>{clearTimeout(S.noteTimers[b.dataset.save]);saveNote(b.dataset.save)});
  document.querySelectorAll("input[type=file]").forEach(inp=>inp.onchange=()=>{const f=inp.files[0];if(f)upload(inp.dataset.t,+inp.dataset.i,f);inp.value=""});
  bindZoom();
}
async function saveNote(k){
  const text=S.noteDraft[k];
  if(text==null||text===slotNote(k)){delete S.noteDraft[k];paintNote(k);return}
  if(S.noteSaving[k])return;
  S.noteSaving[k]=true;paintNote(k);
  try{
    const st=await call("saveNote",S.code,k[0],+k[1],text);
    S.st=st;                                         // 只更新資料，不重畫畫面，避免打斷正在打的字
    if(S.noteDraft[k]===text)delete S.noteDraft[k];
    S.saved[k]=new Date().toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit",hour12:false});
  }catch(e){toast("備註儲存失敗："+errMsg(e))}
  finally{S.noteSaving[k]=false;paintNote(k);if(S.noteDraft[k]!=null&&S.noteDraft[k]!==slotNote(k))scheduleNote(k)}
}
function unsavedNotes(){return Object.keys(S.noteDraft).filter(k=>S.noteDraft[k]!==slotNote(k))}
window.addEventListener("beforeunload",e=>{if(unsavedNotes().length){e.preventDefault();e.returnValue=""}});
async function toDataUrl(file){
  try{
    const bmp=await createImageBitmap(file);
    const max=2400,s=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const cv=document.createElement("canvas");cv.width=Math.round(bmp.width*s);cv.height=Math.round(bmp.height*s);
    cv.getContext("2d").drawImage(bmp,0,0,cv.width,cv.height);
    return cv.toDataURL("image/jpeg",0.88);
  }catch(_){}
  if(["image/jpeg","image/png","image/webp"].includes(file.type)&&file.size<15*1048576)
    return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
  throw new Error("這個格式無法讀取，請改用 JPG 或 PNG");
}
async function readExif(file){
  try{
    const buf=await file.slice(0,262144).arrayBuffer(),v=new DataView(buf);
    if(v.byteLength<4||v.getUint16(0)!==0xFFD8)return null;
    let o=2;
    while(o+10<v.byteLength){
      const mk=v.getUint16(o);if((mk&0xFF00)!==0xFF00)return null;
      const len=v.getUint16(o+2);
      if(mk===0xFFE1&&v.getUint32(o+4)===0x45786966)return parseTiff(v,o+10);
      if(mk===0xFFDA)return null;
      o+=2+len;
    }
  }catch(_){}
  return null;
}
function parseTiff(v,t){
  const le=v.getUint16(t)===0x4949,u16=p=>v.getUint16(p,le),u32=p=>v.getUint32(p,le),out={};
  const str=(p,n)=>{let s="";for(let i=0;i<n&&p+i<v.byteLength;i++){const c=v.getUint8(p+i);if(!c)break;s+=String.fromCharCode(c)}return s.trim()};
  const sizes={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
  const ifd=(p,tags)=>{
    const n=u16(p);
    for(let i=0;i<n;i++){
      const e=p+2+i*12,tag=u16(e),type=u16(e+2),cnt=u32(e+4);
      if(!(tag in tags))continue;
      const dp=(sizes[type]||1)*cnt>4?t+u32(e+8):e+8,k=tags[tag];
      if(type===2)out[k]=str(dp,cnt);
      else if(type===3)out[k]=u16(dp);
      else if(type===4)out[k]=u32(dp);
      else if(type===5){const b=u32(dp+4);out[k]=b?u32(dp)/b:0}
    }
  };
  ifd(t+u32(t+4),{0x010F:"make",0x0110:"model",0x8769:"_exif"});
  if(out._exif)ifd(t+out._exif,{0x829A:"exposure",0x829D:"fnumber",0x8827:"iso",0x920A:"focal",0xA434:"lens",0xA405:"focal35"});
  delete out._exif;
  return Object.keys(out).length?out:null;
}
function setBusy(k,t){S.busy[k]=t;const el=document.getElementById("bz_"+k);if(el)el.textContent=t}
async function upload(T,i,file){
  if(!submitOpen())return toast("投稿已截止");
  const k=T+i;S.busy[k]="讀取照片中…";render();
  let timer=null;
  try{
    const exif=await readExif(file);
    setBusy(k,"壓縮照片中…");
    const data=await toDataUrl(file);
    const mb=(data.length*0.75/1048576).toFixed(1),t0=Date.now();
    const tick=()=>{const sec=Math.round((Date.now()-t0)/1000);setBusy(k,`上傳中 ${mb} MB · ${sec} 秒${sec>20?"（網路較慢，請稍候）":""}`)};
    tick();timer=setInterval(tick,1000);
    const st=await call("uploadPhoto",S.code,T,i,data,exif);
    clearInterval(timer);timer=null;
    apply(st);
    if(S.noteDraft[k]!=null)await saveNote(k);
    toast(`${T}-${i+1} 已上傳`);
  }catch(e){toast("上傳失敗："+errMsg(e))}
  finally{if(timer)clearInterval(timer);S.busy[k]=false;render()}
}

/* ---------- vote ---------- */
function photos(){return S.st.photos||[]}
function myPids(){return (S.st.myEntry||[]).map(e=>e.id)}
function voteCands(T){return shuffled(photos().filter(p=>p.theme===T),S.code+T+cfg().round)}
function need(T){const mine=myPids();return Math.min(3,photos().filter(p=>p.theme===T&&!mine.includes(p.id)).length)}
function voteCode(T){const list=voteCands(T),code={};list.forEach((p,i)=>code[p.id]=T+"-"+String(i+1).padStart(2,"0"));return {list,code}}
function picked(T){return (S.draft&&S.draft[T]||[]).slice(0,need(T)).filter(Boolean).length}
function voteView(){
  const c=cfg();
  if(c.phase==="submit")return `<div class="notice"><h3>投票尚未開始</h3><p>目前有 <b class="mono">${S.st.entrants}</b> 位投稿。主辦人截止投稿後就會開放投票，那時才看得到大家的作品。</p></div>`;
  if(c.phase==="results")return `<div class="notice"><h3>投票已結束</h3><p>結果已經公布，請到「成果」頁查看。</p></div>`;
  if(!myPids().length)return `<div class="notice warn"><h3>只有本期投稿者可以投票</h3><p>你這一期沒有投稿作品，所以無法投票。</p></div>`;
  if(!S.draft)S.draft={A:[],B:[],C:{}};
  const themes=activeThemes();
  if(!S.voteTheme||!themes.includes(S.voteTheme))S.voteTheme=themes[0];
  const T=S.voteTheme,mine=myPids(),{list,code}=voteCode(T),d=S.draft[T]||[],n=need(T);
  let h=`<div class="stack"><div class="notice"><p>每個主題選出你心中的第 1、2、3 名，也可以在作品下留匿名評價。作者、備註、大家的投票和評價都要到公布結果才會顯示。你自己的作品會變淡且不能選。${S.st.myVote?"<br><b>你已投過票，結果公布前都可以修改。</b>":""}</p></div>`;
  const slotsFor=X=>{const {list:L,code:C}=voteCode(X),dd=S.draft[X]||[];
    return `<div class="slots">${[0,1,2].slice(0,need(X)).map(r=>{const pid=dd[r],p=pid&&L.find(x=>x.id===pid);
      return p?`<button class="slot filled" data-goto="${p.id}" data-gt="${X}" aria-label="第 ${r+1} 名 ${C[p.id]}"><span class="sthumb">${img(sized(p.url,200),"")}<i class="m${r+1}">${r+1}</i></span><span class="scode">${C[p.id]}</span></button>`
              :`<span class="slot" aria-label="第 ${r+1} 名未選"><span class="sthumb empty"><i class="m${r+1}">${r+1}</i></span><span class="scode muted">未選</span></span>`}).join("")}</div>`};
  h+=`<div class="vote-bar" id="vbar"><div class="vt-cols${themes.length===1?" single":""}">${themes.map(X=>`<div class="vt-col">
      <button class="vt-btn" data-vt="${X}" aria-pressed="${X===T}"><b>${X}</b>${esc(themeName(X))}<span class="vt-count ${picked(X)===need(X)?"full":""}">${picked(X)}/${need(X)}</span></button>
      ${slotsFor(X)}</div>`).join("")}</div></div>`;
  h+=`<section class="stack" id="vsec" style="gap:10px"><div class="grid">`;
  list.forEach(p=>{
    const isMine=mine.includes(p.id),r=d.indexOf(p.id);
    h+=`<div class="frame ${isMine?"mine":""} ${r>=0&&r<n?"picked":""}" id="card_${p.id}">
      <button class="pic" data-zoom="${esc(p.url)}" aria-label="放大 ${code[p.id]}">${img(sized(p.url,800),"作品 "+code[p.id])}</button>
      <div class="cap"><span class="mono">${code[p.id]}</span>${isMine?`<span class="tag">你的作品</span>`:r>=0&&r<n?`<span class="tag on">第 ${r+1} 名</span>`:""}</div>
      ${isMine?"":`<div class="ranks" role="group" aria-label="${code[p.id]} 名次">${[0,1,2].slice(0,n).map(k=>`<button data-t="${T}" data-p="${p.id}" data-r="${k}" aria-pressed="${r===k}">${k+1}</button>`).join("")}</div>
        <textarea id="c_${p.id}" data-c="${p.id}" rows="2" maxlength="200" placeholder="匿名評價（選填）">${esc((S.draft.C||{})[p.id]||"")}</textarea>`}
    </div>`;
  });
  h+=`</div>`;
  if(themes.length>1){const i=themes.indexOf(T),nx=themes[i+1],pv=themes[i-1];
    h+=`<div class="vt-nav">${pv?`<button class="btn" data-vt="${pv}">← 回到主題 ${pv}</button>`:"<span></span>"}${nx?`<button class="btn primary" data-vt="${nx}">下一步：主題 ${nx} →</button>`:""}</div>`}
  h+=`</section>`;
  const done=themes.every(X=>picked(X)===need(X));
  h+=`<div class="votebar"><span class="small muted">${themes.map(X=>`${X} 已選 <span class="mono">${picked(X)}/${need(X)}</span>`).join("　")}<br>已投票 <span class="mono">${S.st.voted} / ${S.st.entrants}</span> 人</span>
    <button class="btn primary" id="sendVote" ${done?"":"disabled"}>${S.st.myVote?"更新我的投票":"送出投票"}</button></div></div>`;
  return h;
}
function stickyOffset(){const n=$("#tabs"),v=$("#vbar");return (n?n.getBoundingClientRect().bottom:0)+(v?v.offsetHeight:0)}
function scrollToEl(el,extra){if(!el)return;const y=el.getBoundingClientRect().top+window.scrollY-stickyOffset()-(extra||12);window.scrollTo({top:Math.max(0,y),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}
function bindVote(){
  document.querySelectorAll(".ranks button").forEach(b=>b.onclick=()=>{
    S.draftDirty=true;const T=b.dataset.t,p=b.dataset.p,r=+b.dataset.r,d=S.draft[T]=(S.draft[T]||[]).slice();
    if(d[r]===p)d[r]=null;else{for(let k=0;k<3;k++)if(d[k]===p)d[k]=null;d[r]=p}
    render();
  });
  document.querySelectorAll("[data-vt]").forEach(b=>b.onclick=()=>{
    if(b.dataset.vt===S.voteTheme)return;
    S.voteTheme=b.dataset.vt;render();
    const sec=$("#vsec");if(sec){const y=sec.getBoundingClientRect().top+window.scrollY-stickyOffset()-12;if(window.scrollY>y)window.scrollTo(0,Math.max(0,y))}
  });
  document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>{
    if(b.dataset.gt&&b.dataset.gt!==S.voteTheme){S.voteTheme=b.dataset.gt;render()}
    scrollToEl(document.getElementById("card_"+b.dataset.goto));
  });
  document.querySelectorAll("textarea[data-c]").forEach(t=>t.oninput=()=>{S.draftDirty=true;S.draft.C=Object.assign({},S.draft.C,{[t.dataset.c]:t.value})});
  const sv=$("#sendVote");if(sv)sv.onclick=async()=>{
    const body={C:{}};for(const T of activeThemes())body[T]=(S.draft[T]||[]).slice(0,need(T));
    Object.entries(S.draft.C||{}).forEach(([k,v])=>{if(String(v).trim())body.C[k]=String(v)});
    S.draftDirty=false;
    if(!await run("submitVote",[S.code,body],"投票已送出，結果公布前都可以修改"))S.draftDirty=true;
  };
  bindZoom();
}

/* ---------- results ---------- */
function exifLine(e){
  if(!e)return "";
  const p=[];let cam=e.model||"";
  const make=(e.make||"").replace(/\s*(CORPORATION|Corporation|CO\.,?\s*LTD\.?|Co\.,?\s*Ltd\.?|Inc\.?|IMAGING CORP\.?)$/i,"").trim();
  const sony=/^ILCE-?(\w+)/i.exec(cam);
  if(sony)cam="Sony α"+sony[1];
  else if(make&&cam&&!cam.toLowerCase().startsWith(make.toLowerCase().split(" ")[0]))cam=make+" "+cam;
  if(cam)p.push(cam);
  if(e.lens&&e.lens!=="----")p.push(e.lens);
  if(e.focal)p.push(Math.round(e.focal)+"mm");
  if(e.fnumber)p.push("f/"+(Math.round(e.fnumber*10)/10));
  if(e.exposure)p.push(e.exposure>=1?(Math.round(e.exposure*10)/10)+"s":"1/"+Math.round(1/e.exposure)+"s");
  if(e.iso)p.push("ISO "+e.iso);
  return p.join(" · ");
}
function exifHtml(e){const t=exifLine(e);return t?`<div class="exif">${esc(t)}</div>`:""}
function sized(url,w){return String(url||"").replace(/sz=w\d+/,"sz=w"+w)}
function workCard(x,medal,label){
  return `<div class="frame">
    ${label?`<div class="wc-label">${esc(label)}</div>`:""}
    ${medal&&x.rank?`<div class="medal m${x.rank}"><i>${x.rank}</i>第 ${x.rank} 名</div>`:""}
    <button class="pic" data-zoom="${esc(x.url)}">${img(sized(x.url,800),(x.name||"")+" 的作品")}</button>
    <div class="cap">${x.name&&!S.portfolio?`<button class="who name-link" data-name="${esc(x.name)}" title="看 ${esc(x.name)} 的所有作品">${esc(x.name)}</button>`:`<span class="who">${esc(x.name||"（未具名）")}</span>`}</div>
    ${exifHtml(x.exif)}
    ${x.note?`<div class="note">${esc(x.note)}</div>`:""}
    ${(x.comments||[]).length?`<details class="cm"><summary>${x.comments.length} 則匿名評價</summary><ul>${x.comments.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></details>`:""}
  </div>`;
}
function isAdmin(){return !!(S.st&&S.st.me&&S.st.me.isAdmin)}
function sortedRounds(res){return Object.keys(res).sort((a,b)=>(res[b].publishedAt||0)-(res[a].publishedAt||0)||(a<b?1:-1))}
function fmtDay(ms){return ms?new Date(ms).toLocaleDateString("zh-TW",{year:"numeric",month:"long",day:"numeric"}):""}
function roundYear(k,R){const m=/^(\d{4})/.exec(k);return m?m[1]:(R.publishedAt?String(new Date(R.publishedAt).getFullYear()):"其他")}
function eventCard(k,R){
  const cf={themeA:R.themeA,themeB:R.themeB};
  const rows=T2.filter(T=>(R[T]||[]).length).map(T=>{
    const top=(R[T]||[]).filter(x=>x.rank).sort((a,b)=>a.rank-b.rank);
    return `<div class="ev-row"><div class="ev-theme"><b>${T}</b>${esc(themeName(T,cf))}</div>
      ${top.length?`<div class="thumbs">${top.map(x=>`<span class="tcell"><span class="thumb">${img(sized(x.url,400),"")}<i class="m${x.rank}">${x.rank}</i></span><span class="tname">${esc(x.name||"")}</span></span>`).join("")}</div>`:`<p class="small muted">沒有名次資料</p>`}</div>`;
  }).join("");
  return `<button class="event" data-r="${esc(k)}" aria-label="查看 ${esc(R.title||k)}">
    <div class="ev-head"><span class="ev-title">${esc(R.title||k)}</span><span class="ev-date">${esc(k)}${R.publishedAt?" · "+esc(fmtDay(R.publishedAt)):""}</span></div>
    ${rows}
  </button>`;
}
/* 捲動時標示目前看到的是哪個主題 */
function markJump(){
  const bar=$("#evbar"),btns=document.querySelectorAll("[data-jump]");if(!bar||!btns.length)return;
  const line=bar.getBoundingClientRect().bottom+40;let cur=btns[0].dataset.jump;
  btns.forEach(b=>{const sec=document.getElementById("sec-"+b.dataset.jump);if(sec&&sec.getBoundingClientRect().top<=line)cur=b.dataset.jump});
  if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-4)cur=btns[btns.length-1].dataset.jump;
  btns.forEach(b=>b.setAttribute("aria-current",b.dataset.jump===cur?"true":"false"));
}
window.addEventListener("scroll",()=>{if(S.tab==="results"&&S.resultRound&&!S.portfolio)markJump()},{passive:true});
async function loadResults(){
  if(S.loadingResults)return;S.loadingResults=true;
  try{S.results=await call("getResults")||{}}
  catch(e){S.results=S.results||{};toast("成果讀取失敗："+errMsg(e))}
  finally{S.loadingResults=false;if(S.tab==="results")render()}
}
function boardData(res,year){
  const tbl={};
  sortedRounds(res).filter(k=>roundYear(k,res[k])===year).forEach(k=>{
    const R=res[k];
    T2.forEach(T=>(R[T]||[]).forEach(x=>{
      if(!x.name)return;
      const p=tbl[x.name]=tbl[x.name]||{name:x.name,pts:0,g:0,s:0,b:0,works:0,rounds:new Set()};
      p.works++;p.rounds.add(k);
      if(x.rank===1){p.pts+=3;p.g++}else if(x.rank===2){p.pts+=2;p.s++}else if(x.rank===3){p.pts+=1;p.b++}
    }));
  });
  const list=Object.values(tbl).sort((a,b)=>b.pts-a.pts||b.g-a.g||b.s-a.s||b.b-a.b||a.name.localeCompare(b.name,"zh-Hant"));
  let rank=0,prev=null;list.forEach((p,i)=>{const key=[p.pts,p.g,p.s,p.b].join();if(key!==prev){rank=i+1;prev=key}p.rank=rank});
  return list;
}
function resultsView(){
  if(!S.results){if(!S.loadingResults)loadResults();return `<div class="notice">正在載入成果…</div>`}
  const res=S.results,keys=sortedRounds(res);
  if(!keys.length)return `<div class="notice"><h3>還沒有公布的成果</h3><p>每期活動公布結果後，前三名和所有作品就會出現在這裡。</p></div>`;
  if(S.resultRound&&!res[S.resultRound])S.resultRound=null;
  const seg=`<div class="seg" role="tablist"><button data-rv="events" aria-selected="${S.resView!=="board"}">活動成果</button><button data-rv="board" aria-selected="${S.resView==="board"}">${isAdmin()?"年度積分榜":"年度成員"}</button></div>`;
  /* 個人作品集 */
  if(S.portfolio){
    const name=S.portfolio,items=[];
    keys.forEach(k=>{const R=res[k];T2.forEach(T=>(R[T]||[]).forEach(x=>{if(x.name===name)items.push({k,R,T,x})}))});
    const medals=items.filter(i=>i.x.rank).length;
    return `<div class="stack"><div class="stack" style="gap:6px"><button class="link" id="pfback">← 返回</button>
      <h2>${esc(name)} 的作品集</h2><p class="small muted">${items.length} 件作品 · ${new Set(items.map(i=>i.k)).size} 次活動${medals?` · 前三名 ${medals} 次`:""}</p></div>
      <div class="grid big">${items.map(i=>workCard(i.x,true,`${i.R.title||i.k} · ${themeName(i.T,{themeA:i.R.themeA,themeB:i.R.themeB})}`)).join("")}</div></div>`;
  }
  /* 年度積分榜 */
  if(S.resView==="board"){
    const years=Array.from(new Set(keys.map(k=>roundYear(k,res[k])))).sort().reverse();
    if(!S.boardYear||!years.includes(S.boardYear))S.boardYear=years[0];
    const list=boardData(res,S.boardYear),n=keys.filter(k=>roundYear(k,res[k])===S.boardYear).length;
    const yearSel=`<label class="field" for="by" style="min-width:160px">年度<select id="by">${years.map(y=>`<option value="${esc(y)}" ${y===S.boardYear?"selected":""}>${esc(y)} 年</option>`).join("")}</select></label>`;
    if(!isAdmin()){
      const names=list.map(p=>p.name).sort((a,b)=>a.localeCompare(b,"zh-Hant"));
      return `<div class="stack">${seg}
        <div class="row" style="justify-content:space-between;align-items:end">${yearSel}<p class="small muted">${n} 次活動 · ${names.length} 位攝影者參加</p></div>
        <p class="small muted">點名字可以看這位攝影者的所有作品。</p>
        <div class="member-chips">${names.map(nm=>`<button class="member-chip" data-name="${esc(nm)}">${esc(nm)}</button>`).join("")}</div></div>`;
    }
    return `<div class="stack">${seg}
      <div class="row" style="justify-content:space-between;align-items:end"><label class="field" for="by" style="min-width:160px">年度<select id="by">${years.map(y=>`<option value="${esc(y)}" ${y===S.boardYear?"selected":""}>${esc(y)} 年</option>`).join("")}</select></label>
      <p class="small muted">${n} 次活動 · 每個主題第 1 名 3 分、第 2 名 2 分、第 3 名 1 分</p></div>
      <div class="tablewrap"><table class="board"><thead><tr><th>名次</th><th>攝影者</th><th>積分</th><th>1 / 2 / 3 名</th><th>作品</th></tr></thead><tbody>
      ${list.map(p=>`<tr class="${p.rank<=3&&p.pts>0?"top":""}"><td class="mono">${p.pts>0?p.rank:"—"}</td><td><button class="name-link" data-name="${esc(p.name)}">${esc(p.name)}</button></td><td class="mono">${p.pts}</td><td class="mono">${p.g} / ${p.s} / ${p.b}</td><td class="mono">${p.works}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  }
  let h=`<div class="stack">${seg}<div class="row" style="justify-content:space-between;align-items:end">
    <label class="field" for="rr" style="min-width:220px">活動<select id="rr"><option value="">全部活動</option>${keys.map(k=>`<option value="${esc(k)}" ${k===S.resultRound?"selected":""}>${esc(res[k].title||k)}（${esc(k)}）</option>`).join("")}</select></label>
    ${S.resultRound?`<div class="row">${S.st.me&&S.st.me.isAdmin?(res[S.resultRound].deckUrl?`<a class="btn" href="${esc(res[S.resultRound].deckUrl)}" target="_blank" rel="noopener">開啟簡報</a><button class="btn" id="mkdeck">重新產生簡報</button>`:`<button class="btn" id="mkdeck">產生簡報</button>`):""}<button class="btn primary" id="play">發表會模式</button></div>`:""}</div>`;
  if(!S.resultRound){
    return h+`<p class="small muted">共 ${keys.length} 次活動，由新到舊排列。點活動可查看完整成果，點名字可看個人作品集。</p><div class="events">${keys.map(k=>eventCard(k,res[k])).join("")}</div></div>`;
  }
  const R=res[S.resultRound],cf={themeA:R.themeA,themeB:R.themeB};
  const jumps=T2.filter(T=>(R[T]||[]).length);
  h+=`<div class="ev-bar" id="evbar"><div class="ev-bar-info"><button class="link" id="back">← 全部活動</button>
    <h2>${esc(R.title||S.resultRound)}</h2><p class="small muted">${esc(S.resultRound)}${R.publishedAt?" · "+esc(fmtDay(R.publishedAt)):""} · <span class="mono">${R.entrants}</span> 位攝影者參加</p></div>
    ${jumps.length>1?`<div class="jumps">${jumps.map(T=>`<button class="jump" data-jump="${T}"><b>${T}</b>${esc(themeName(T,cf))}</button>`).join("")}</div>`:""}</div>`;
  for(const T of T2){
    const list=R[T]||[],top=list.filter(x=>x.rank).sort((a,b)=>a.rank-b.rank),rest=list.filter(x=>!x.rank);
    if(!list.length)continue;
    const desc=R["desc"+T];
    h+=`<section class="stack theme-sec" id="sec-${T}" style="gap:14px"><div><h2><span class="mono">${T}</span>　${esc(themeName(T,cf))}</h2>${desc?`<p class="small muted">${esc(desc)}</p>`:""}</div>
      ${top.length?`<div class="podium">${top.map(x=>workCard(x,true)).join("")}</div>`:""}
      ${rest.length?`<h3 class="muted" style="font-size:13px;letter-spacing:.14em">其他作品</h3><div class="grid">${rest.map(x=>workCard(x,false)).join("")}</div>`:""}
    </section>`;
  }
  return h+`</div>`;
}
function bindResults(){
  const top=()=>window.scrollTo(0,0);
  document.querySelectorAll("[data-rv]").forEach(b=>b.onclick=()=>{S.resView=b.dataset.rv;S.portfolio=null;render()});
  const by=$("#by");if(by)by.onchange=()=>{S.boardYear=by.value;render()};
  const rr=$("#rr");if(rr)rr.onchange=()=>{S.resultRound=rr.value||null;render();top()};
  document.querySelectorAll(".event[data-r]").forEach(b=>b.onclick=()=>{S.resultRound=b.dataset.r;render();top()});
  document.querySelectorAll(".name-link[data-name],.member-chip[data-name]").forEach(b=>b.onclick=e=>{e.stopPropagation();S.portfolio=b.dataset.name;render();top()});
  const pf=$("#pfback");if(pf)pf.onclick=()=>{S.portfolio=null;render();top()};
  const bk=$("#back");if(bk)bk.onclick=()=>{S.resultRound=null;render();top()};
  const pl=$("#play");if(pl)pl.onclick=()=>playShow(S.results[S.resultRound]);
  document.querySelectorAll("[data-jump]").forEach(b=>b.onclick=()=>{
    const sec=document.getElementById("sec-"+b.dataset.jump),bar=$("#evbar");if(!sec)return;
    const y=sec.getBoundingClientRect().top+window.scrollY-($("#tabs")?$("#tabs").getBoundingClientRect().bottom:0)-(bar?bar.offsetHeight:0)-12;
    window.scrollTo({top:Math.max(0,y),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  });
  markJump();
  const md=$("#mkdeck");if(md)md.onclick=async()=>{
    md.disabled=true;md.textContent="產生中，約需 1 分鐘…";
    try{const r=await call("buildDeck",S.code,S.resultRound);S.results[S.resultRound].deckUrl=r.url;toast("簡報已產生，存在你雲端硬碟的照片資料夾");render()}
    catch(e){toast("產生失敗："+errMsg(e));md.disabled=false;md.textContent="產生簡報"}
  };
  bindZoom();
}

/* ---------- 開新一期 ---------- */
function activeThemes(c=cfg()){return c&&c.themeCount===1?["A"]:["A","B"]}
function perTheme(c=cfg()){return (c&&c.photosPerTheme)||2}
function announceText(c,st){
  const L=[`【影聚】${c.title||c.round} 開始投稿！`];
  activeThemes(c).forEach(T=>{const n=(T==="A"?c.themeA:c.themeB)||"（待公布）",d=themeDesc(T,c);L.push(`主題 ${T}：${n}${d?"——"+d:""}`)});
  L.push(`每個主題 ${perTheme(c)} 張，共 ${perTheme(c)*activeThemes(c).length} 張。`);
  if(c.deadlineAt)L.push(`投稿截止：${fmtDate(c.deadlineAt)}`);
  if(c.voteDeadlineAt)L.push(`投票截止：${fmtDate(c.voteDeadlineAt)}`);
  L.push(`網址：${(S.st&&S.st.appUrl)||"（網址）"}`);
  return L.join("\n");
}
function msgBox(id,title,hint,text){
  return `<div class="panel"><h2>${title}</h2>${hint?`<p class="small muted">${hint}</p>`:""}
    <textarea id="${id}" class="plain msg" rows="6" readonly>${esc(text)}</textarea>
    <div><button class="btn" data-copy="${id}">複製訊息</button></div></div>`;
}
function nextPanel(st){
  const c=st.cfg,n=st.nextOpen,p=S.nextDraft;
  if(!p){
    return `<div class="panel next-panel"><div class="row" style="justify-content:space-between;align-items:center">
      <div><h2>開新一期</h2><p class="small muted">自動帶入下個月的期別、名稱和截止時間，確認後才會建立。</p></div>
      <button class="btn primary" id="nx_go">開始下一期</button></div>
      ${n?`<p class="small">排程開期：<b>${esc(fmtDate(n.at))}</b> 自動開 ${esc(n.round)}。${n.waiting?`<span class="warn-text">本期公布結果後才會自動開。</span>`:""}</p>`:""}</div>`;
  }
  const dl=p.deadlineAt,vdl=p.voteDeadlineAt;
  return `<div class="panel next-panel confirm"><h2>確認新一期</h2>
    ${p.unfinished?`<div class="notice warn"><b>本期（${esc(p.current)}）還在${p.currentPhase==="vote"?"投票":"投稿"}中，還沒公布結果。</b><p class="small">開新一期後，本期就無法再投稿或投票，也不會自動計票。建議先到「活動階段」按「計票並公布結果」。</p>
      <label class="check" for="nx_force"><input type="checkbox" id="nx_force">我了解，仍要開新一期</label></div>`:""}
    ${p.exists?`<div class="notice warn"><p class="small">期別 ${esc(p.round)} 已經有成果紀錄，用同一個期別辦活動，公布時會覆蓋舊的成果。可以改用其他期別代號。</p></div>`:""}
    <div class="fields">
      <label class="field" for="nx_round">期別代號<input type="text" id="nx_round" value="${esc(p.round)}"></label>
      <label class="field" for="nx_title">活動名稱<input type="text" id="nx_title" value="${esc(p.title)}"></label>
      <label class="field" for="nx_tc">主題數<select id="nx_tc"><option value="2" ${p.themeCount!==1?"selected":""}>2 個主題</option><option value="1" ${p.themeCount===1?"selected":""}>1 個主題</option></select></label>
      <label class="field" for="nx_pp">每個主題幾張<select id="nx_pp">${[1,2,3,4].map(k=>`<option value="${k}" ${p.photos===k?"selected":""}>${k} 張</option>`).join("")}</select></label>
      <label class="field" for="nx_dl">投稿截止<input type="datetime-local" id="nx_dl" value="${toLocalInput(dl)}"></label>
      <label class="field" for="nx_vdl">投票截止<input type="datetime-local" id="nx_vdl" value="${toLocalInput(vdl)}"></label>
    </div>
    <label class="check" for="nx_draw"><input type="checkbox" id="nx_draw" ${p.autoDraw?"checked":""}>建立時用轉盤自動抽主題（沒勾的話，建立後到「抽主題」分頁抽）</label>
    <div class="row"><button class="btn primary" id="nx_ok">確認開始</button><button class="btn" id="nx_cancel">取消</button></div></div>`;
}
function applicantsPanel(st){
  const list=st.applicants||[];if(!list.length)return "";
  return `<div class="panel applicants"><h2>新成員申請 <span class="badge">${list.length}</span></h2>
    <p class="small muted">核准後會自動加進試算表的「成員」，對方就能用工號後三碼登入。</p>
    <div class="ap-list">${list.map(a=>`<div class="ap-row"><div class="ap-info"><b>${esc(a.name)}</b><span class="mono">${esc(a.empId)}</span><span class="small muted">${a.at?esc(fmtDate(a.at)):""}</span></div>
      <div class="ap-btns"><button class="btn sm" data-rej="${a.id}">拒絕</button><button class="btn sm primary" data-ok="${a.id}">核准</button></div></div>`).join("")}</div></div>`;
}
function rulesPanel(st){
  const r=st.cfg.rules||{},days=Array.from({length:31},(_,i)=>i+1);
  return `<details class="panel rules"${S.rulesOpen?" open":""}><summary><h2>開新一期的預設</h2><span class="small muted">截止日規則、主題數、自動抽主題、排程開期</span></summary>
    <div class="fields">
      <label class="field" for="r_type">投稿截止規則<select id="r_type"><option value="day" ${r.dlType==="day"?"selected":""}>每月固定日期</option><option value="lastSun" ${r.dlType==="lastSun"?"selected":""}>每月最後一個週日</option><option value="none" ${r.dlType==="none"?"selected":""}>不預設</option></select></label>
      <label class="field" for="r_day">固定日期<select id="r_day">${days.map(d=>`<option value="${d}" ${r.dlDay===d?"selected":""}>每月 ${d} 日${d>28?"（月底沒有就用最後一天）":""}</option>`).join("")}</select></label>
      <label class="field" for="r_time">截止時刻<input type="time" id="r_time" value="${esc(r.dlTime||"23:59")}"></label>
      <label class="field" for="r_vd">投票截止＝投稿截止後幾天<select id="r_vd">${[0,1,2,3,4,5,6,7,10,14].map(d=>`<option value="${d}" ${r.voteDays===d?"selected":""}>${d?d+" 天":"不預設"}</option>`).join("")}</select></label>
      <label class="field" for="r_tc">預設主題數<select id="r_tc"><option value="2" ${r.themeCount!==1?"selected":""}>2 個主題</option><option value="1" ${r.themeCount===1?"selected":""}>1 個主題</option></select></label>
      <label class="field" for="r_pp">預設每個主題幾張<select id="r_pp">${[1,2,3,4].map(k=>`<option value="${k}" ${r.photos===k?"selected":""}>${k} 張</option>`).join("")}</select></label>
    </div>
    <label class="check" for="r_draw"><input type="checkbox" id="r_draw" ${r.autoDraw?"checked":""}>開新一期時自動抽主題</label>
    <div class="sched">
      <label class="check" for="r_sched"><input type="checkbox" id="r_sched" ${r.schedOn?"checked":""}>排程自動開期（時間到自動開下一期，套用上面的預設）</label>
      <div class="fields">
        <label class="field" for="r_sday">每月幾號開<select id="r_sday">${days.slice(0,28).map(d=>`<option value="${d}" ${r.schedDay===d?"selected":""}>每月 ${d} 日</option>`).join("")}</select></label>
        <label class="field" for="r_stime">開期時刻<input type="time" id="r_stime" value="${esc(r.schedTime||"09:00")}"></label>
      </div>
      <p class="small muted">排程只會在本期已公布結果後才開新一期；如果本期還在投票，會等到公布後的下一次檢查（約 5 分鐘內）。</p>
    </div>
    <div><button class="btn primary" id="r_save">儲存預設</button></div></details>`;
}
function bindNext(){
  const go=$("#nx_go");if(go)go.onclick=async()=>{
    go.disabled=true;go.textContent="準備中…";
    try{const r=await call("previewNextRound",S.code);S.nextDraft=r.proposal;render();const el=$(".next-panel");if(el)el.scrollIntoView({block:"start",behavior:"smooth"})}
    catch(e){toast(errMsg(e));go.disabled=false;go.textContent="開始下一期"}
  };
  const cancel=$("#nx_cancel");if(cancel)cancel.onclick=()=>{S.nextDraft=null;render()};
  const ok=$("#nx_ok");if(ok)ok.onclick=async()=>{
    const p=S.nextDraft,force=$("#nx_force");
    if(p.unfinished&&!(force&&force.checked))return toast("請先勾選「我了解，仍要開新一期」");
    const dv=$("#nx_dl").value,vv=$("#nx_vdl").value,dl=dv?new Date(dv).getTime():null,vdl=vv?new Date(vv).getTime():null;
    if(dl&&vdl&&vdl<=dl)return toast("投票截止時間要晚於投稿截止時間");
    const body={round:$("#nx_round").value.trim(),title:$("#nx_title").value.trim(),themeCount:+$("#nx_tc").value,photos:+$("#nx_pp").value,deadlineAt:dl,voteDeadlineAt:vdl,autoDraw:$("#nx_draw").checked,force:!!(force&&force.checked)};
    ok.disabled=true;ok.textContent="建立中…";
    const done=await run("openNextRound",[S.code,body],"新一期已開始！公告已準備好");
    if(done){S.nextDraft=null;S.justOpened=true;S.results=null;
      const c=cfg();if(activeThemes(c).some(T=>!(T==="A"?c.themeA:c.themeB))){toast("主題還沒抽，帶你到抽主題分頁");S.tab="draw"}
      render();window.scrollTo(0,0)}
    else{ok.disabled=false;ok.textContent="確認開始"}
  };
  const rs=$("#r_save");if(rs)rs.onclick=()=>{
    S.rulesOpen=true;
    run("saveRules",[S.code,{dlType:$("#r_type").value,dlDay:+$("#r_day").value,dlTime:$("#r_time").value,voteDays:+$("#r_vd").value,themeCount:+$("#r_tc").value,photos:+$("#r_pp").value,autoDraw:$("#r_draw").checked,schedOn:$("#r_sched").checked,schedDay:+$("#r_sday").value,schedTime:$("#r_stime").value}],"預設已儲存");
  };
  const det=$("details.rules");if(det)det.ontoggle=()=>{S.rulesOpen=det.open};
  document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>{
    const t=document.getElementById(b.dataset.copy);if(!t)return;
    const done=()=>toast("已複製，可以貼到群組了");
    const fallback=()=>{t.focus();t.select();try{document.execCommand("copy");done()}catch(e){toast("請長按文字手動複製")}};
    try{navigator.clipboard.writeText(t.value).then(done,fallback)}catch(_){fallback()}
  });
}

/* ---------- admin ---------- */
function adminView(){
  const st=S.st,c=st.cfg.round?st.cfg:{round:nextMonth(),title:"",themeA:st.cfg.themeA||"",themeB:st.cfg.themeB||"",phase:"submit"};
  let h=`<div class="stack">${applicantsPanel(st)}${nextPanel(st)}<div class="panel"><h2>活動設定</h2>
    <div class="fields">
      <label class="field" for="a_round">期別代號（改成新代號就是開新一期）<input type="text" id="a_round" value="${esc(c.round)}" placeholder="2026-11"></label>
      <label class="field" for="a_title">活動名稱<input type="text" id="a_title" value="${esc(c.title)}" placeholder="十一月攝影活動"></label>
      <label class="field" for="a_A">主題 A<input type="text" id="a_A" value="${esc(c.themeA)}" placeholder="例如：城市的光"></label>
      <label class="field" for="a_B">主題 B<input type="text" id="a_B" value="${esc(c.themeB)}" placeholder="例如：紅色"></label>
      <label class="field" for="a_dA">主題 A 說明（選填）<textarea id="a_dA" class="plain" rows="2" maxlength="200" placeholder="例如：畫面主色是紅色，不限題材">${esc(c.descA||"")}</textarea></label>
      <label class="field" for="a_dB">主題 B 說明（選填）<textarea id="a_dB" class="plain" rows="2" maxlength="200" placeholder="例如：夜晚的城市燈光">${esc(c.descB||"")}</textarea></label>
      <label class="field" for="a_dl">投稿截止時間（留空表示不限）<input type="datetime-local" id="a_dl" value="${toLocalInput(c.deadlineAt)}"></label>
      <label class="field" for="a_vdl">投票截止時間（留空表示不限）<input type="datetime-local" id="a_vdl" value="${toLocalInput(c.voteDeadlineAt)}"></label>
      <label class="field" for="a_tc">主題數<select id="a_tc"><option value="2" ${c.themeCount!==1?"selected":""}>2 個主題</option><option value="1" ${c.themeCount===1?"selected":""}>1 個主題（主題 B 不用填）</option></select></label>
      <label class="field" for="a_pp">每個主題幾張<select id="a_pp">${[1,2,3,4].map(k=>`<option value="${k}" ${(c.photosPerTheme||2)===k?"selected":""}>${k} 張</option>`).join("")}</select></label>
    </div>
    <label class="check" for="a_auto"><input type="checkbox" id="a_auto" ${c.autoSwitch!==false?"checked":""}>時間到自動切換：投稿截止後自動開放投票，投票截止後自動計票並公布結果</label><div><button class="btn primary" id="a_save">${st.cfg.round?"儲存設定":"建立活動"}</button></div></div>`;
  if(!st.cfg.round)return h+rulesPanel(st)+`</div>`;
  h+=`<div class="panel"><h2>活動階段</h2><div class="row">
      <button class="btn ${c.phase==="submit"?"primary":""}" data-phase="submit">1. 開放投稿</button>
      <button class="btn ${c.phase==="vote"?"primary":""}" data-phase="vote">2. 截止投稿，開放投票</button>
      <button class="btn ${c.phase==="results"?"primary":""}" data-phase="results">3. 計票並公布結果</button></div>
    ${autoStatus(c)}
    <p class="small muted">隨時都可以用上面的按鈕手動切換。按第 2 步時，大家的照片才會出現在投票頁（不含作者和備註）。按第 3 步會計票，成果頁只公布前三名和署名，不公布分數。若有人補投，再按一次第 3 步即可更新。</p></div>`;
  if(c.phase!=="results"){
    if(c.phase==="submit")h+=msgBox("a_ann",S.justOpened?"開期公告（新一期已建立）":"開期公告","新一期開始時貼到群組。主題或截止時間有改，這裡會跟著更新。",announceText(c,st));
    h+=msgBox("a_msg",c.phase==="vote"?"催票訊息":"催稿訊息","複製後貼到群組，只列人數，不會點名。",reminderText(c,st));
  }else{
    h+=`<div class="panel"><h2>發表會簡報</h2>${st.deck?`<p class="small">本期簡報已產生，存在你雲端硬碟的「攝影月賽照片」資料夾。</p><div class="row"><a class="btn primary" href="${esc(st.deck.url)}" target="_blank" rel="noopener">開啟 Google 簡報</a><button class="btn" id="a_deck">重新產生</button></div>`
      :`<p class="small">公布結果後會自動產生，大約需要 1 分鐘，之後按「重新整理」就會出現連結。也可以直接按下面的按鈕。</p><div><button class="btn" id="a_deck">立即產生簡報</button></div>`}</div>`;
  }
  h+=`<div class="panel"><div class="row" style="justify-content:space-between"><h2>本期名單</h2><button class="btn" id="a_ref">重新整理</button></div>
    <p class="small muted"><span class="mono">${st.entrants}</span> 位投稿 · <span class="mono">${st.voted}</span> 人已投票。成員和代碼請到試算表的「成員」工作表新增。</p>
    <div class="tablewrap"><table><thead><tr><th>名字</th><th>照片</th><th>投票</th></tr></thead><tbody>${(st.roster||[]).map(r=>`<tr><td>${esc(r.name||"（未填）")}</td><td class="mono">${r.n} / ${perTheme()*activeThemes().length}</td><td>${r.voted?'<span class="ok">✓ 已投</span>':'<span class="muted">—</span>'}</td></tr>`).join("")}</tbody></table></div></div>`;
  if(st.fullTally){
    h+=`<div class="panel"><h2>完整計分</h2><p class="small muted">只有你看得到，不會公布。第 1 名 3 分、第 2 名 2 分、第 3 名 1 分，同分比較第 1 名票數。共 <span class="mono">${st.fullTally.voters}</span> 人投票。</p>`;
    for(const T of activeThemes())h+=`<h3><span class="mono">${T}</span>　${esc(themeName(T))}</h3><div class="tablewrap"><table><thead><tr><th>名次</th><th>作者</th><th>分數</th><th>1st / 2nd / 3rd</th></tr></thead><tbody>${(st.fullTally[T]||[]).map(x=>`<tr><td class="mono">${x.rank}</td><td>${esc(x.name)}</td><td class="mono">${x.pts}</td><td class="mono">${x.r1} / ${x.r2} / ${x.r3}</td></tr>`).join("")}</tbody></table></div>`;
    h+=`</div>`;
  }
  h+=rulesPanel(st);
  return h+`</div>`;
}
function reminderText(c,st){
  const url=st.appUrl||"（網址）",L=[];
  if(c.phase==="vote"){
    const left=Math.max(0,st.entrants-st.voted);
    L.push(`【影聚】${c.title||c.round} 投票進行中！`);
    L.push(`目前 ${st.voted} / ${st.entrants} 位投稿者已投票${left?`，還有 ${left} 位還沒投`:"，全員都投完了"}。`);
    if(c.voteDeadlineAt)L.push(`投票截止：${fmtDate(c.voteDeadlineAt)}`);
  }else{
    L.push(`【影聚】${c.title||c.round} 投稿中！`);
    L.push(`本期主題：${activeThemes(c).map(T=>`${T}「${(T==="A"?c.themeA:c.themeB)||"待公布"}」`).join("、")}，每個主題 ${perTheme(c)} 張。`);
    L.push(`目前已有 ${st.entrants} 位投稿。`);
    if(c.deadlineAt)L.push(`投稿截止：${fmtDate(c.deadlineAt)}`);
  }
  L.push(`網址：${url}`);
  return L.join("\n");
}
function autoStatus(c){
  if(!c.autoSwitch)return `<p class="small">自動切換：已關閉，請手動切換。</p>`;
  const t=[];
  if(c.deadlineAt)t.push(c.autoVoteFor===c.round?"投稿截止後已自動開放投票":`投稿截止（${esc(fmtDate(c.deadlineAt))}）後自動開放投票`);
  if(c.voteDeadlineAt)t.push(c.autoResultFor===c.round?"投票截止後已自動公布結果":`投票截止（${esc(fmtDate(c.voteDeadlineAt))}）後自動公布結果`);
  return `<p class="small">自動切換：${t.length?t.join("；"):"還沒設定截止時間"}。系統約每 5 分鐘檢查一次，有人打開網頁時也會立即檢查。</p>`;
}
function bindAdmin(){
  bindNext();
  document.querySelectorAll("[data-ok]").forEach(b=>b.onclick=()=>{b.disabled=true;run("reviewApplicant",[S.code,b.dataset.ok,true],"已核准，對方現在可以登入了")});
  document.querySelectorAll("[data-rej]").forEach(b=>b.onclick=()=>{
    if(b.dataset.sure!=="1"){b.dataset.sure="1";b.textContent="確定拒絕？";b.classList.add("danger");setTimeout(()=>{if(b.isConnected){b.dataset.sure="";b.textContent="拒絕";b.classList.remove("danger")}},4000);return}
    b.disabled=true;run("reviewApplicant",[S.code,b.dataset.rej,false],"已拒絕這筆申請")});
  const sv=$("#a_save");if(sv)sv.onclick=()=>{
    const dv=$("#a_dl").value,dl=dv?new Date(dv).getTime():null,vv=$("#a_vdl").value,vdl=vv?new Date(vv).getTime():null;
    if((dv&&isNaN(dl))||(vv&&isNaN(vdl)))return toast("截止時間格式不正確");
    if(dl&&vdl&&vdl<=dl)return toast("投票截止時間要晚於投稿截止時間");
    const isNew=$("#a_round").value.trim()!==cfg().round;
    run("saveConfig",[S.code,{round:$("#a_round").value.trim(),title:$("#a_title").value.trim(),themeA:$("#a_A").value.trim(),themeB:$("#a_B").value.trim(),descA:$("#a_dA").value.trim(),descB:$("#a_dB").value.trim(),themeCount:+$("#a_tc").value,photosPerTheme:+$("#a_pp").value,deadlineAt:dl,voteDeadlineAt:vdl,autoSwitch:$("#a_auto").checked}],isNew?"已開始新一期，開放投稿中":"設定已儲存");
  };
  document.querySelectorAll("[data-phase]").forEach(b=>b.onclick=()=>{
    const p=b.dataset.phase;toast(p==="results"?"正在計票…":"更新中…");
    run("setPhase",[S.code,p],{submit:"已開放投稿",vote:"已開放投票，投稿已鎖定",results:"結果已公布，簡報約 1 分鐘後產生"}[p]).then(()=>{S.results=null});
  });
  const rf=$("#a_ref");if(rf)rf.onclick=()=>refresh();
  const cp=$("#a_copy");if(cp)cp.onclick=()=>{const t=$("#a_msg");
    const done=()=>toast("已複製，可以貼到群組了");
    const fallback=()=>{t.focus();t.select();try{document.execCommand("copy");done()}catch(e){toast("請長按文字手動複製")}};
    try{navigator.clipboard.writeText(t.value).then(done,fallback)}catch(_){fallback()}};
  const dk=$("#a_deck");if(dk)dk.onclick=async()=>{
    dk.disabled=true;dk.textContent="產生中，約需 1 分鐘…";
    try{await call("buildDeck",S.code,cfg().round);S.results=null;toast("簡報已產生");await refresh()}
    catch(e){toast("產生失敗："+errMsg(e));dk.disabled=false;dk.textContent="立即產生簡報"}
  };
}

/* ---------- overlays ---------- */
function bindZoom(){document.querySelectorAll("[data-zoom]").forEach(b=>b.onclick=()=>openLightbox(b.dataset.zoom))}
function openLightbox(src){
  const o=$("#overlay");
  o.innerHTML=`<div class="overlay lightbox" role="dialog" aria-label="作品大圖"><img src="${esc(src)}" alt="作品大圖" referrerpolicy="no-referrer"><div class="lb-bar"><button class="lb-btn" id="lbz">原尺寸</button><button class="lb-btn" id="lbx">關閉 ✕</button></div></div>`;
  const box=o.firstChild,im=box.querySelector("img");
  const toggle=e=>{e.stopPropagation();box.classList.toggle("full");$("#lbz").textContent=box.classList.contains("full")?"符合畫面":"原尺寸"};
  im.onclick=toggle;$("#lbz").onclick=toggle;
  $("#lbx").onclick=e=>{e.stopPropagation();o.innerHTML=""};
  box.onclick=()=>{o.innerHTML=""};
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$(".lightbox"))$("#overlay").innerHTML=""});
function playShow(R){
  if(!R)return;const cf={themeA:R.themeA,themeB:R.themeB},slides=[{k:"title"}];
  for(const T of T2){const list=R[T]||[];if(!list.length)continue;slides.push({k:"theme",T});
    list.forEach(x=>slides.push({k:"work",T,x}));
    const top=list.filter(x=>x.rank);if(top.length){slides.push({k:"top",T});[...top].sort((a,b)=>b.rank-a.rank).forEach(x=>slides.push({k:"rank",T,x}))}}
  slides.push({k:"end"});
  let i=0;const o=$("#overlay");
  o.innerHTML=`<div class="overlay show" role="dialog" aria-label="發表會"><div class="stage" id="st"></div><div class="bar"><button id="sx">結束</button><span id="sn"></span><span><button id="sp">←</button> <button id="sf">→</button></span></div></div>`;
  const root=o.firstChild;
  const draw=()=>{const s=slides[i],tn=s.T?themeName(s.T,cf):"";let h="";
    if(s.k==="title")h=`<div class="big">${esc(R.title||"影聚")}</div><div class="sub mono">${esc(R.round)} · ${R.entrants} 位攝影者</div>`;
    else if(s.k==="theme")h=`<div class="sub mono">主題 ${s.T}</div><div class="big">${esc(tn)}</div>${R["desc"+s.T]?`<div class="sub" style="font-size:15px;max-width:40ch">${esc(R["desc"+s.T])}</div>`:""}<div class="sub">全部作品</div>`;
    else if(s.k==="work")h=`${img(s.x.url,"")}<div class="sub">${esc(s.x.name||"")}　<span class="mono">${s.T}</span></div>${exifLine(s.x.exif)?`<div class="sub" style="font-size:13px">${esc(exifLine(s.x.exif))}</div>`:""}${s.x.note?`<div class="sub" style="font-size:clamp(14px,1.8vw,18px);max-width:60ch">${esc(s.x.note)}</div>`:""}`;
    else if(s.k==="top")h=`<div class="sub mono">主題 ${s.T} · ${esc(tn)}</div><div class="big">前三名揭曉</div>`;
    else if(s.k==="rank")h=`<div class="medal m${s.x.rank}" style="justify-content:center;font-size:clamp(20px,3vw,30px)"><i style="width:40px;height:40px">${s.x.rank}</i>第 ${s.x.rank} 名</div>${img(s.x.url,"")}<div class="sub">${esc(s.x.name||"")}</div>`;
    else h=`<div class="big">恭喜得獎者</div><div class="sub">謝謝大家這個月的作品</div>`;
    root.querySelector("#st").innerHTML=h;root.querySelector("#sn").textContent=(i+1)+" / "+slides.length};
  const go=d=>{i=Math.max(0,Math.min(slides.length-1,i+d));draw()};
  const close=()=>{document.removeEventListener("keydown",key);try{if(document.fullscreenElement)document.exitFullscreen()}catch(_){}o.innerHTML=""};
  const key=e=>{if(e.key==="ArrowRight"||e.key===" "||e.key==="PageDown"){e.preventDefault();go(1)}else if(e.key==="ArrowLeft"||e.key==="PageUp")go(-1);else if(e.key==="Escape")close()};
  document.addEventListener("keydown",key);
  root.querySelector("#st").onclick=e=>{const r=root.getBoundingClientRect();go(e.clientX<r.left+r.width/3?-1:1)};
  root.querySelector("#sp").onclick=()=>go(-1);root.querySelector("#sf").onclick=()=>go(1);root.querySelector("#sx").onclick=close;
  try{const p=root.requestFullscreen&&root.requestFullscreen();p&&p.catch&&p.catch(()=>{})}catch(_){}
  draw();
}


/* ---------- draw (theme wheels) ---------- */
S.rot={A:0,B:0};S.wheelDraft={};S.spinning=false;S.lastPick={};
function wheelList(T){return (cfg()&&cfg()["wheel"+T])||[]}
function drawView(){
  const c=cfg(),started=c.round&&(S.st.entrants>0||c.phase!=="submit");
  let h=`<div class="stack"><div class="notice"><p>在下方輸入每個主題的候選選項，按「抽籤」轉出結果。抽中的選項會直接成為本期的主題 ${c.round?"（"+esc(c.round)+"）":""}，大家的頁面也會同步更新。</p>
    ${started?`<p class="small">本期已經有人投稿或已進入投票，這時更換主題會讓大家看到的主題跟著改變，請先確認。</p>`:""}</div><div class="wheels">`;
  for(const T of activeThemes()){
    const list=wheelList(T),draft=S.wheelDraft[T]??list.join("\n"),dirty=S.wheelDraft[T]!=null&&S.wheelDraft[T]!==list.join("\n");
    h+=`<section class="panel wheel-card">
      <div class="row" style="justify-content:space-between"><h2>主題 ${T}</h2><span class="small muted">目前：<b class="cur">${esc(themeName(T))}</b></span></div>
      <div class="wheel-wrap"><div class="pointer" aria-hidden="true"></div><canvas id="wh${T}" class="wheel" aria-label="主題 ${T} 轉盤"></canvas></div>
      <div class="pick" id="pk${T}">${S.lastPick[T]?`抽中：<b>${esc(S.lastPick[T])}</b>`:"&nbsp;"}</div>
      <button class="btn primary wide" id="sp${T}" ${list.length<2||dirty?"disabled":""}>抽籤</button>
      ${list.length<2?`<p class="small muted center">至少要有 2 個選項才能抽籤</p>`:dirty?`<p class="small muted center">選項有修改，請先儲存</p>`:""}
      <label class="field" for="wo${T}">轉盤選項（每行一個，最多 30 個）<textarea class="opts" id="wo${T}" data-w="${T}" rows="6" placeholder="例如：&#10;紅色&#10;城市的光&#10;影子">${esc(draft)}</textarea></label>
      <div class="row" style="justify-content:space-between"><button class="btn" id="ws${T}" ${dirty?"":"disabled"}>儲存選項</button>
      <label class="check" for="wr${T}"><input type="checkbox" id="wr${T}" ${cfg()["wheelRemove"+T]?"checked":""}>抽中後從轉盤移除，避免重複</label></div>
    </section>`;
  }
  return h+`</div></div>`;
}
function bindDraw(){
  for(const T of activeThemes()){
    paintWheel(T);
    const ta=$("#wo"+T);ta.oninput=()=>{const was=S.wheelDraft[T];S.wheelDraft[T]=ta.value;const dirty=ta.value!==wheelList(T).join("\n");$("#ws"+T).disabled=!dirty;$("#sp"+T).disabled=dirty||wheelList(T).length<2};
    $("#ws"+T).onclick=async()=>{
      const list=Array.from(new Set(ta.value.split("\n").map(x=>x.trim()).filter(Boolean))).slice(0,30);
      if(await run("saveWheel",[S.code,T,list],"選項已儲存")){delete S.wheelDraft[T];render()}
    };
    $("#sp"+T).onclick=()=>spin(T);
    $("#wr"+T).onchange=e=>run("setWheelRemove",[S.code,T,e.target.checked],e.target.checked?"抽中的選項之後會自動移除":"已關閉自動移除");
  }
}
function paintWheel(T){
  const cv=$("#wh"+T);if(!cv)return;
  const list=wheelList(T),size=Math.min(300,cv.parentElement.clientWidth||300),dpr=window.devicePixelRatio||1;
  cv.style.width=cv.style.height=size+"px";cv.width=cv.height=Math.round(size*dpr);
  const g=cv.getContext("2d");g.scale(dpr,dpr);const r=size/2,cx=r,cy=r;
  g.clearRect(0,0,size,size);
  if(!list.length){g.beginPath();g.arc(cx,cy,r-2,0,Math.PI*2);g.fillStyle="#FFFFFF";g.fill();g.strokeStyle="#D9D3C7";g.lineWidth=1;g.stroke();
    g.fillStyle="#9A958B";g.font="14px 'Noto Sans TC',sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText("尚未設定選項",cx,cy);}
  const n=list.length,seg=Math.PI*2/Math.max(n,1);
  list.forEach((t,i)=>{
    const a0=-Math.PI/2+i*seg,a1=a0+seg;
    g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,r-2,a0,a1);g.closePath();
    g.fillStyle=i%2?"#F2EEE5":"#FFFFFF";g.fill();g.strokeStyle="#D9D3C7";g.lineWidth=1;g.stroke();
    g.save();g.translate(cx,cy);g.rotate(a0+seg/2);g.fillStyle="#3E3A35";
    const fs=n>16?11:n>10?12:14;g.font=`${fs}px 'Noto Sans TC',sans-serif`;g.textAlign="right";g.textBaseline="middle";
    let label=t;const maxW=r*0.68;while(g.measureText(label).width>maxW&&label.length>1)label=label.slice(0,-1);
    if(label!==t)label=label.slice(0,-1)+"…";
    g.fillText(label,r-14,0);g.restore();
  });
  g.beginPath();g.arc(cx,cy,r*0.12,0,Math.PI*2);g.fillStyle="#FFFFFF";g.fill();g.strokeStyle="#D9D3C7";g.stroke();
  cv.style.transition="none";cv.style.transform=`rotate(${S.rot[T]}deg)`;
}
async function spin(T){
  if(S.spinning)return;
  const list=wheelList(T);if(list.length<2)return;
  S.spinning=true;document.querySelectorAll(".wheel-card button").forEach(b=>b.disabled=true);
  $("#pk"+T).innerHTML="抽籤中…";
  let res;
  try{res=await call("drawTheme",S.code,T)}catch(e){S.spinning=false;toast(errMsg(e));render();return}
  const n=list.length,seg=360/n,center=(res.index+0.5)*seg,jitter=(Math.random()-0.5)*seg*0.6;
  const cur=S.rot[T],target=((360-center-jitter)%360+360)%360,base=cur-(((cur%360)+360)%360);
  const end=base+360*6+target;
  const cv=$("#wh"+T),reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  cv.style.transition=reduce?"none":"transform 4.2s cubic-bezier(.12,.6,.1,1)";
  requestAnimationFrame(()=>{cv.style.transform=`rotate(${end}deg)`});
  S.rot[T]=end;
  setTimeout(()=>{
    S.spinning=false;S.lastPick[T]=res.pick;
    apply(res.state);toast(`主題 ${T} 抽中「${res.pick}」，已更新為本期主題`);
  },reduce?200:4400);
}

/* ---------- start ---------- */
S.code=lsGet("pc_code");
refresh();
setInterval(()=>{if(S.st&&!S.composing)renderHead()},30000);
setInterval(()=>{
  const ae=document.activeElement,typing=ae&&(ae.tagName==="TEXTAREA"||ae.tagName==="INPUT");
  if(document.visibilityState==="visible"&&!typing&&!S.composing&&!unsavedNotes().length&&!S.working&&!S.spinning&&!Object.values(S.busy).some(Boolean)&&!$("#overlay").innerHTML)refresh();
},60000);
