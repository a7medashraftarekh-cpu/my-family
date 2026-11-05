import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,updateDoc,collection,query,where,orderBy,limit,onSnapshot,addDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ===== 1) حط بيانات مشروع Firebase بتاعك هنا ===== */
const firebaseConfig={apiKey:"PUT_API_KEY",authDomain:"PUT_PROJECT.firebaseapp.com",projectId:"PUT_PROJECT",appId:"PUT_APP_ID"};
/* ===== 2) إيميل الليدر (لازم يتطابق مع firestore.rules) ===== */
const LEADER="leader@myfamily.app";

const auth=getAuth(initializeApp(firebaseConfig)),db=getFirestore();
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const mail=c=>`${c.trim().toLowerCase()}@myfamily.app`,pass=c=>`MF-${c.trim()}`;
const STICKERS=("😀😂🥹😍🥰😎🤩😴🤔😭😡🥳👍👏🙏💪🔥💯❤️💙💚🎉🎂🌹☕🍕🍫⚽📚✅❌😅🤝👋🙈😇🤗😜🤯🫡🫶🌙⭐🌊🏖️🚀").match(/\p{Extended_Pictographic}\uFE0F?/gu);
const show=id=>["auth","wait","app"].forEach(x=>$("#"+x).hidden=x!==id);
const toast=t=>{const e=$("#toast");e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,2800)};
const av=(u,c="")=>u?.photo?`<img class="av ${c}" src="${u.photo}">`:`<div class="av ${c}">${esc((u?.nickname||"؟")[0])}</div>`;
const time=t=>(t?.toDate?t.toDate():new Date()).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"});

let me,mine,users={},priv={},unsubs=[],chatUnsub,isLeader=false,started=false,view="list",chatId,chatTitle;

/* منع التصوير: ضبابية لما التطبيق يتخبّى + قفل حقيقي لما يتحوّل APK بـ Capacitor */
const blur=()=>document.body.classList.toggle("hide",document.hidden||!document.hasFocus());
document.addEventListener("visibilitychange",blur);addEventListener("blur",blur);addEventListener("focus",blur);
document.addEventListener("contextmenu",e=>e.preventDefault());
window.Capacitor?.Plugins?.PrivacyScreen?.enable?.();
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});

/* ---------- دخول / تسجيل ---------- */
$("#tLogin").onclick=()=>{$("#tLogin").className="on";$("#tReg").className="";$("#pLogin").hidden=false;$("#pReg").hidden=true};
$("#tReg").onclick=()=>{$("#tReg").className="on";$("#tLogin").className="";$("#pReg").hidden=false;$("#pLogin").hidden=true};
$("#toLeader").onclick=()=>{const b=$("#leaderBox");b.hidden=!b.hidden;$("#lCode").hidden=!b.hidden};
$("#bLogin").onclick=async()=>{
  try{
    if(!$("#leaderBox").hidden)await signInWithEmailAndPassword(auth,$("#lMail").value.trim(),$("#lPass").value);
    else{const c=$("#lCode").value;if(!c.trim())return toast("اكتب كود الطالب");await signInWithEmailAndPassword(auth,mail(c),pass(c))}
  }catch{toast("الكود غلط أو لسه متسجلش")}
};
$("#bReg").onclick=async()=>{
  const code=$("#rCode").value.trim(),name=$("#rName").value.trim().replace(/\s+/g," "),nick=$("#rNick").value.trim();
  if(!/^[A-Za-z0-9]{3,20}$/.test(code))return toast("الكود حروف إنجليزي وأرقام بس");
  if(name.split(" ").length<4)return toast("اكتب الاسم رباعي");
  if(nick.length<2)return toast("اكتب نك نيم");
  try{
    const cr=await createUserWithEmailAndPassword(auth,mail(code),pass(code));
    await setDoc(doc(db,"users_private",cr.user.uid),{code,fullName:name});
    await setDoc(doc(db,"users",cr.user.uid),{nickname:nick,about:"",photo:"",status:"pending",restrict:false,allowed:[],createdAt:serverTimestamp()});
  }catch(e){toast(e.code==="auth/email-already-in-use"?"الكود ده مسجل قبل كده، اعمل دخول":"حصلت مشكلة، جرّب تاني")}
};
$("#waitOut").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async u=>{
  unsubs.forEach(f=>f());unsubs=[];chatUnsub?.();started=false;me=u;
  if(!u){show("auth");return}
  isLeader=u.email===LEADER;
  if(isLeader){const r=doc(db,"users",u.uid);if(!(await getDoc(r)).exists())await setDoc(r,{nickname:"الليدر",about:"",photo:"",status:"approved",role:"leader",restrict:false,allowed:[]})}
  unsubs.push(onSnapshot(doc(db,"users",u.uid),s=>{
    mine=s.data();
    if(!mine)return show("wait");
    if(mine.status==="approved"){if(!started){started=true;show("app");start()}else if(view==="list")go("list")}
    else if(mine.status==="rejected"){toast("الطلب اتقفل من الليدر");signOut(auth)}
    else show("wait");
  }));
});

/* ---------- التشغيل ---------- */
function start(){
  const q=isLeader?collection(db,"users"):query(collection(db,"users"),where("status","==","approved"));
  unsubs.push(onSnapshot(q,s=>{users={};s.forEach(d=>users[d.id]=d.data());["list","leader"].includes(view)&&go(view)}));
  if(isLeader)unsubs.push(onSnapshot(collection(db,"users_private"),s=>{priv={};s.forEach(d=>priv[d.id]=d.data());view==="leader"&&go("leader")}));
  go("list");
}
const top=(title,sub,back,btns="")=>$("#top").innerHTML=`${back?'<button class="ic" data-a="back">➜</button>':av(mine)}<h2>${title}${sub?`<small>${sub}</small>`:""}</h2>${btns}`;
$("#top").onclick=e=>{const a=e.target.closest("[data-a]")?.dataset.a;if(a==="back")go("list");if(a==="me")go("profile");if(a==="leader")go("leader")};

function go(v,id,title){
  view=v;chatUnsub?.();chatUnsub=null;$("#composer").hidden=v!=="chat";$("#stickers").hidden=true;
  const m=$("#main");m.className="";
  if(v==="list"){
    top("my family","",false,`${isLeader?'<button class="ic" data-a="leader">👥</button>':""}<button class="ic" data-a="me">⚙</button>`);
    const vis=Object.entries(users).filter(([i,u])=>i!==me.uid&&u.status==="approved"&&(!u.restrict||(u.allowed||[]).includes(me.uid)));
    m.innerHTML=`<div class="item" data-chat="general" data-t="المجموعة العامة"><div class="av">🌊</div><div class="grow"><b>المجموعة العامة</b><small>كل أفراد العيلة</small></div></div>`+
      (vis.length?vis.map(([i,u])=>`<div class="item" data-chat="${i}" data-t="${esc(u.nickname)}">${av(u)}<div class="grow"><b>${esc(u.nickname)}</b><small>${esc(u.about||"")}</small></div></div>`).join(""):'<div class="empty">لسه مفيش حد تاني متاح</div>');
    m.onclick=e=>{const c=e.target.closest("[data-chat]");if(c)go("chat",c.dataset.chat,c.dataset.t)};
  }
  if(v==="chat"){
    chatId=id==="general"?"general":[me.uid,id].sort().join("_");chatTitle=title;
    top(esc(title),"",true);m.className="chat";m.innerHTML="";
    chatUnsub=onSnapshot(query(collection(db,"chats",chatId,"messages"),orderBy("createdAt","desc"),limit(100)),s=>{
      m.innerHTML=s.docs.reverse().map(d=>{const x=d.data(),own=x.from===me.uid;
        return `<div class="m ${own?"me":""} ${x.type==="sticker"?"st":""}">${chatId==="general"&&!own?`<b>${esc(users[x.from]?.nickname||"")}</b>`:""}${x.type==="sticker"?`<span>${esc(x.text)}</span>`:esc(x.text)}<i>${time(x.createdAt)}</i></div>`}).join("");
      m.scrollTop=m.scrollHeight;
    },()=>toast("مش مسموحلك تفتح الشات ده"));
  }
  if(v==="profile"){
    top("ملفي الشخصي","",true);
    const others=Object.entries(users).filter(([i,u])=>i!==me.uid&&u.status==="approved");
    m.innerHTML=`<div class="pf"><div data-pick>${av(mine,"big")}</div><span class="note">اضغط على الصورة لتغييرها</span>
      <input id="pNick" value="${esc(mine.nickname)}" maxlength="20" placeholder="النك نيم">
      <input id="pAbout" value="${esc(mine.about||"")}" maxlength="60" placeholder="الحالة (مثال: مشغول)">
      <label class="chk"><input type="checkbox" id="pRes" ${mine.restrict?"checked":""}><span>ناس محددين بس يكلموني برايفت</span></label>
      <div id="pList" ${mine.restrict?"":"hidden"}>${others.map(([i,u])=>`<label class="chk" style="margin-bottom:6px"><input type="checkbox" value="${i}" ${(mine.allowed||[]).includes(i)?"checked":""}>${av(u)}<span>${esc(u.nickname)}</span></label>`).join("")||'<div class="note">مفيش حد لسه</div>'}</div>
      <button class="btn" id="pSave">حفظ</button><button class="btn alt" id="pOut">تسجيل خروج</button></div>`;
    m.onclick=e=>{if(e.target.closest("[data-pick]"))$("#file").click()};
    $("#pRes").onchange=e=>$("#pList").hidden=!e.target.checked;
    $("#pOut").onclick=()=>signOut(auth);
    $("#pSave").onclick=async()=>{
      const allowed=[...document.querySelectorAll("#pList input:checked")].map(x=>x.value);
      await updateDoc(doc(db,"users",me.uid),{nickname:$("#pNick").value.trim()||mine.nickname,about:$("#pAbout").value.trim(),restrict:$("#pRes").checked,allowed});toast("تم الحفظ ✓");
    };
  }
  if(v==="leader"){
    top("الطلاب","",true);
    const rows=Object.entries(users).filter(([i])=>i!==me.uid).sort((a,b)=>(a[1].status==="pending"?0:1)-(b[1].status==="pending"?0:1));
    m.innerHTML=rows.map(([i,u])=>{const p=priv[i]||{};const st=u.status;
      return `<div class="item ${st==="pending"?"pend":""}">${av(u)}<div class="grow"><b>${esc(p.fullName||"—")}</b><small>${esc(u.nickname)} • كود: ${esc(p.code||"")}</small></div>
      ${st!=="approved"?`<button class="pill ok" data-s="approved" data-i="${i}">${st==="pending"?"موافقة":"تفعيل"}</button>`:""}
      ${st!=="rejected"?`<button class="pill no" data-s="rejected" data-i="${i}">${st==="pending"?"رفض":"إيقاف"}</button>`:""}</div>`}).join("")||'<div class="empty">مفيش طلبات</div>';
    m.onclick=e=>{const b=e.target.closest("[data-s]");if(b)updateDoc(doc(db,"users",b.dataset.i),{status:b.dataset.s})};
  }
}

/* ---------- رسائل وملصقات ---------- */
const send=async(text,type="text")=>{
  if(!text.trim())return;
  try{await addDoc(collection(db,"chats",chatId,"messages"),{from:me.uid,text,type,createdAt:serverTimestamp()})}
  catch{toast("مش مسموحلك تبعت للشخص ده")}
};
$("#bSend").onclick=()=>{send($("#msg").value);$("#msg").value=""};
$("#msg").onkeydown=e=>{if(e.key==="Enter")$("#bSend").click()};
$("#stickers").innerHTML=STICKERS.map(s=>`<button data-s="${s}">${s}</button>`).join("");
$("#stickers").onclick=e=>{const b=e.target.closest("[data-s]");if(b){send(b.dataset.s,"sticker");$("#stickers").hidden=true}};
$("#bSt").onclick=()=>$("#stickers").hidden=!$("#stickers").hidden;

/* ---------- صورة البروفايل (بتتصغّر وتتخزن جوه الداتا) ---------- */
$("#file").onchange=e=>{
  const f=e.target.files[0];if(!f)return;const im=new Image();
  im.onload=async()=>{const c=document.createElement("canvas"),s=Math.min(im.width,im.height);c.width=c.height=200;
    c.getContext("2d").drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,200,200);
    await updateDoc(doc(db,"users",me.uid),{photo:c.toDataURL("image/jpeg",.7)});go("profile");e.target.value=""};
  im.src=URL.createObjectURL(f);
};
