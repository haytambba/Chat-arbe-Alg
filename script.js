const firebaseConfig = {
    apiKey: "AIzaSyCmZOwHDaMkpJtl9Is4p7YuhjtFZZ7pHv4",
    authDomain: "chat-algerie-a2c71.firebaseapp.com",
    projectId: "chat-algerie-a2c71",
    storageBucket: "chat-algerie-a2c71.firebasestorage.app",
    messagingSenderId: "122054820778",
    appId: "1:122054820778:web:9997e980072fb4014be1d3",
    measurementId: "G-MYRPJ3CMNB"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function sendMessage() {
    let name = document.getElementById("username").value;
    let msg = document.getElementById("message").value;

    if (name.trim() === "" || msg.trim() === "") return;

    db.ref("messages").push({
        username: name,
        message: msg
    });

    document.getElementById("message").value = "";
}

db.ref("messages").on("child_added", snapshot => {
    let data = snapshot.val();
    let chatBox = document.getElementById("chat-box");

    let msgDiv = document.createElement("div");
    msgDiv.className = "msg";
    msgDiv.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
});
