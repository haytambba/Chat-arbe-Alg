// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, where, serverTimestamp, doc, setDoc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/* ---------- ضع تكوين Firebase الخاص بك هنا (من إعداد المشروع) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyCmZOwHDaMkpJtl9Is4p7YuhjtFZZ7pHv4",
  authDomain: "chat-algerie-a2c71.firebaseapp.com",
  projectId: "chat-algerie-a2c71",
  storageBucket: "chat-algerie-a2c71.firebasestorage.app",
  messagingSenderId: "122054820778",
  appId: "1:122054820778:web:9997e980072fb4014be1d3",
  measurementId: "G-MYRPJ3CMNB"
};
/* -------------------------------------------------------------------- */

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

const usersListEl = document.getElementById('usersList');
const messagesEl = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const usernameInput = document.getElementById('usernameInput');
const saveNameBtn = document.getElementById('saveNameBtn');
const targetNameEl = document.getElementById('targetName');
const btnPublic = document.getElementById('btnPublic');

let me = null; // current user { uid, name }
let selectedUser = { id: 'public', name: 'عام (Public)' }; // default target

// تسجيل دخول مجهول
signInAnonymously(auth).catch(err => alert("Firebase auth error: " + err.message));
onAuthStateChanged(auth, user => {
  if (!user) return;
  const uid = user.uid;
  // حاول أن نقرأ الاسم من localStorage
  let name = localStorage.getItem('chat_name') || `زائر-${uid.slice(-4)}`;
  me = { uid, name };
  usernameInput.value = name;
  // نكتب المعلومات في مجموعة users
  const uDoc = doc(db, 'users', uid);
  setDoc(uDoc, { uid, name, lastSeen: serverTimestamp() }, { merge: true });
  listenUsers();
  setCurrentTarget('public', 'عام (Public)');
  listenPublic();
});

// حفظ اسم المستخدم
saveNameBtn.addEventListener('click', async () => {
  const v = (usernameInput.value || '').trim();
  if (!v) return alert('اكتب اسماً');
  localStorage.setItem('chat_name', v);
  if (!me) return;
  me.name = v;
  await setDoc(doc(db, 'users', me.uid), { uid: me.uid, name: v, lastSeen: serverTimestamp() }, { merge: true });
  alert('تم حفظ الاسم');
});

// إرسال رسالة
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

async function sendMessage(){
  if (!me) return alert('جاري تسجيل الدخول، انتظر لحظة...');
  const text = (msgInput.value || '').trim();
  if (!text) return;
  const payload = {
    text,
    fromId: me.uid,
    fromName: me.name,
    toId: selectedUser.id === 'public' ? 'public' : selectedUser.id,
    toName: selectedUser.name,
    timestamp: serverTimestamp()
  };
  await addDoc(collection(db, 'messages'), payload);
  msgInput.value = '';
}

// الاستماع للمستخدمين لملئ القايمة
let usersUnsub = null;
function listenUsers(){
  const q = query(collection(db, 'users'), orderBy('name'));
  if (usersUnsub) usersUnsub();
  usersUnsub = onSnapshot(q, snap => {
    usersListEl.innerHTML = '';
    // نضيف خيار العام أولاً
    const liPublic = document.createElement('li');
    liPublic.textContent = 'عام (Public)';
    liPublic.classList.add(selectedUser.id === 'public' ? 'active' : '');
    liPublic.onclick = () => {
      setCurrentTarget('public', 'عام (Public)');
      listenPublic();
    };
    usersListEl.appendChild(liPublic);

    snap.forEach(docSnap => {
      const u = docSnap.data();
      // لا نعرض نفسنا مرتين
      if (u.uid === me.uid) return;
      const li = document.createElement('li');
      li.textContent = u.name || 'مستخدم';
      li.onclick = () => {
        setCurrentTarget(u.uid, u.name);
        listenPrivate(u.uid);
      };
      if (selectedUser.id === u.uid) li.classList.add('active');
      usersListEl.appendChild(li);
    });
  });
}

// helpers لتبديل الهدف
let publicUnsub = null;
let privateUnsub = null;
function setCurrentTarget(id, name){
  selectedUser = { id, name };
  targetNameEl.textContent = name;
  // تفعيل زر العام إذا public
  btnPublic.classList.toggle('active', id === 'public');
  // تفعيل الواجهة البصرية للمستخدم في القائمة
  Array.from(usersListEl.children).forEach(li => {
    li.classList.toggle('active', li.textContent === name);
  });
  messagesEl.innerHTML = '';
}

// الاستماع لرسائل العام
function listenPublic(){
  if (privateUnsub) { privateUnsub(); privateUnsub = null; }
  const qPublic = query(collection(db, 'messages'), where('toId', '==', 'public'), orderBy('timestamp'));
  if (publicUnsub) publicUnsub();
  publicUnsub = onSnapshot(qPublic, snap => {
    const arr = [];
    snap.forEach(doc => { arr.push({ id: doc.id, ...doc.data() }); });
    renderMessages(arr);
  });
}

// الاستماع للمحادثة الخاصة بيني وبين userId
function listenPrivate(userId){
  if (publicUnsub) { publicUnsub(); publicUnsub = null; }
  // نجلب الرسائل التي توجهت إما لي أو للمستخدم الآخر
  // query where toId in [me.uid, userId] AND fromId in [me.uid, userId]
  // (يعمل لجلب الرسائل بين الطرفين)
  const q = query(collection(db, 'messages'),
    where('toId', 'in', [me.uid, userId]),
    orderBy('timestamp')
  );
  // سنحتاج أيضاً لجلب الرسائل المرسلة من الطرفين حيث toId هو الآخر
  // لكن شرط fromId in [...] لا يمكن دمجه بسهولة في نفس استعلام، لذلك نستعمل استعلامين وندمجهما
  const q2 = query(collection(db, 'messages'),
    where('fromId', 'in', [me.uid, userId]),
    orderBy('timestamp')
  );

  // إلغاء أي مستمع سابق
  if (privateUnsub) privateUnsub();
  // نستخدم onSnapshot على كلا الاستعلامين وندمج النتائج محلياً (بترتيب timestamp)
  const results = {};
  const apply = () => {
    const merged = Object.values(results).sort((a,b)=>{
      if (!a.timestamp) return -1;
      if (!b.timestamp) return 1;
      return a.timestamp.seconds - b.timestamp.seconds;
    })
    // فلترة احترافية: نعرض فقط الرسائل التي هي إما خاصة بين الطرفين (toId === me||userId && fromId===me||userId)
    const filtered = merged.filter(m=>{
      if (!m.toId) return false;
      if (m.toId === 'public') return false;
      const set = [me.uid, userId];
      return set.includes(m.toId) && set.includes(m.fromId);
    });
    renderMessages(filtered);
  };

  const unsubA = onSnapshot(q, snap => {
    snap.forEach(d=> results[d.id] = { id:d.id, ...d.data() });
    apply();
  });
  const unsubB = onSnapshot(q2, snap =>{
    snap.forEach(d=> results[d.id] = { id:d.id, ...d.data() });
    apply();
  });

  privateUnsub = () => { unsubA(); unsubB(); };
}

// عرض الرسائل في الصفحة
function renderMessages(arr){
  messagesEl.innerHTML = '';
  arr.forEach(m => {
    const div = document.createElement('div');
    const mine = m.fromId === me.uid;
    div.className = 'msg ' + (mine ? 'me' : 'other');
    const meta = document.createElement('div');
    meta.className = 'meta';
    const toInfo = m.toId === 'public' ? 'عام' : (m.toName || '');
    meta.textContent = `${m.fromName} → ${toInfo} • ${formatTime(m.timestamp)}`;
    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = m.text;
    div.appendChild(meta);
    div.appendChild(text);
    messagesEl.appendChild(div);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatTime(ts){
  if (!ts) return '';
  if (ts.seconds) {
    const d = new Date(ts.seconds * 1000);
    return d.toLocaleString();
  }
  return '';
}

// زر التنقل للعامة
btnPublic.addEventListener('click', () => {
  setCurrentTarget('public', 'عام (Public)');
  listenPublic();
});
