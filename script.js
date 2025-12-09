// ----- ضع هنا إعدادات Firebase الخاصة بك -----
const firebaseConfig = {
  apiKey: "REPLACE_APIKEY",
  authDomain: "REPLACE_PROJECT.firebaseapp.com",
  databaseURL: "https://REPLACE_PROJECT-default-rtdb.firebaseio.com",
  projectId: "REPLACE_PROJECT",
  storageBucket: "REPLACE_PROJECT.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX"
};
// ---------------------------------------------

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentRoom = null;

// عناصر DOM
const roomsEl = document.getElementById('rooms');
const usersEl = document.getElementById('users');
const chatBox = document.getElementById('chat-box');
const roomTitle = document.getElementById('roomTitle');
const msgInput = document.getElementById('msg');
const sendBtn = document.getElementById('sendBtn');
const nameInput = document.getElementById('name');
const rankSelect = document.getElementById('rank');
const saveProfile = document.getElementById('saveProfile');
const newRoomBtn = document.getElementById('newRoomBtn');
const toUser = document.getElementById('toUser');
const meDiv = document.getElementById('me');
const logoutBtn = document.getElementById('logout');

// anonymous sign-in
auth.signInAnonymously().catch(console.error);
auth.onAuthStateChanged(user => {
  if(!user) return;
  currentUser = { uid: user.uid };
  meDiv.textContent = `متصل: ${user.uid}`;
  // create user entry with default data if not exists
  db.ref('users/'+user.uid).once('value', snap => {
    if(!snap.exists()){
      db.ref('users/'+user.uid).set({name:'ضيف', rank:'member', online:true});
    } else {
      db.ref('users/'+user.uid).update({online:true});
    }
  });
  listenRooms();
  listenUsers();
});

// rooms
function listenRooms(){
  db.ref('rooms').on('value', snap => {
    roomsEl.innerHTML = '';
    snap.forEach(child => {
      const li = document.createElement('li');
      li.textContent = child.key;
      li.onclick = ()=> joinRoom(child.key);
      if(currentRoom === child.key) li.classList.add('active');
      roomsEl.appendChild(li);
    });
  });
}

// join or create room
function joinRoom(name){
  if(currentRoom) db.ref('rooms/'+currentRoom+'/members/'+currentUser.uid).remove();
  currentRoom = name;
  roomTitle.textContent = "غرفة: " + name;
  chatBox.innerHTML = '';
  db.ref('rooms/'+name+'/members/'+currentUser.uid).set(true);
  // listen messages
  db.ref('rooms/'+name+'/messages').off();
  db.ref('rooms/'+name+'/messages').on('child_added', snap => {
    const m = snap.val();
    appendMsg(m);
  });
}

// append message to chat
function appendMsg(m){
  const div = document.createElement('div');
  div.className = 'msg';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<b>${m.fromName||m.from}</b> <small>${m.time||''}</small> ${m.to?`→ <small>${m.toName||m.to}</small>`:''}`;
  const text = document.createElement('div');
  text.textContent = m.text;
  div.appendChild(meta);
  div.appendChild(text);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// send message
sendBtn.onclick = ()=> {
  const txt = msgInput.value.trim();
  if(!txt || !currentRoom) return alert('اختر غرفة أو اكتب رسالة');
  // to (private) or empty=public
  const to = toUser.value || '';
  const fromUid = currentUser.uid;
  db.ref('users/'+fromUid).once('value').then(snap=>{
    const me = snap.val() || {};
    const payload = {
      from: fromUid,
      fromName: me.name || 'ضيف',
      text: txt,
      time: new Date().toLocaleTimeString(),
      to: to
    };
    // public room messages
    db.ref('rooms/'+currentRoom+'/messages').push(payload);
    // if private -> also push under private messages path (for direct retrieval)
    if(to){
      db.ref('private/'+[fromUid,to].sort().join('_')+'/messages').push(payload);
    }
    msgInput.value = '';
  });
};

// users list & ranks
function listenUsers(){
  db.ref('users').on('value', snap=>{
    usersEl.innerHTML = '';
    toUser.innerHTML = '<option value="">عام</option>';
    snap.forEach(u=>{
      const data = u.val();
      const div = document.createElement('div');
      div.innerHTML = `<b>${data.name||u.key}</b> <small>${data.rank||'member'}</small>`;
      usersEl.appendChild(div);
      // add to select for private chat
      const opt = document.createElement('option');
      opt.value = u.key;
      opt.textContent = data.name || u.key;
      toUser.appendChild(opt);
    });
  });
}

// save profile (name + rank)
saveProfile.onclick = ()=>{
  const name = nameInput.value.trim() || 'ضيف';
  const rank = rankSelect.value;
  if(!currentUser) return alert('جارٍ الاتصال');
  db.ref('users/'+currentUser.uid).update({name, rank});
};

// create room
newRoomBtn.onclick = ()=>{
  const r = prompt('اسم الغرفة:','عام');
  if(!r) return;
  db.ref('rooms/'+r+'/meta').set({createdAt:Date.now()});
  joinRoom(r);
};

// logout (set offline)
logoutBtn.onclick = ()=>{
  if(currentUser) db.ref('users/'+currentUser.uid).update({online:false});
  auth.signOut();
  meDiv.textContent = 'خارج';
};

// basic cleanup on unload
window.addEventListener('beforeunload', ()=>{
  if(currentUser) db.ref('users/'+currentUser.uid).update({online:false});
});
