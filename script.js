:root{--bg:#0f1720;--card:#111827;--accent:#38bdf8;--text:#e6eef6}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,Segoe UI,Roboto,Arial;background:var(--bg);color:var(--text)}
header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#071021}
main{display:flex;height:calc(100vh - 56px)}
.left{width:300px;background:#08111a;padding:12px;overflow:auto;border-left:4px solid #06212b}
.left h3{margin:8px 0}
.left ul{list-style:none;padding:0;margin:0}
.left ul li{padding:8px;border-radius:6px;margin:6px 0;background:#071622;cursor:pointer}
.left ul li.active{background:var(--accent);color:#003244}
.left button,input,select{width:100%;padding:8px;margin:6px 0;border-radius:6px;border:1px solid #223}
.chat{flex:1;display:flex;flex-direction:column}
.chat-header{display:flex;justify-content:space-between;align-items:center;padding:12px;background:#04121a;border-bottom:1px solid #082}
.chat-box{flex:1;padding:12px;overflow:auto}
.msg{background:#071827;padding:8px;margin:8px 0;border-radius:8px;max-width:75%}
.msg .meta{font-size:12px;color:#9fb6c8;margin-bottom:6px}
.composer{display:flex;padding:12px;border-top:1px solid #082;background:#04121a}
.composer input{flex:1;padding:10px;border-radius:6px;border:1px solid #123;margin-right:8px}
.composer button{padding:10px 14px;border-radius:6px;border:none;background:var(--accent);color:#022}
@media(max-width:700px){.left{width:220px}}auth.onAuthStateChanged(user => {
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
