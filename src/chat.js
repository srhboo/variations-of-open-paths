var socket = io("https://diligent-nine-guitar.glitch.me/");
var messages = document.getElementById("messages");
var messageForm = document.getElementById("message-form");
var messageInput = document.getElementById("message-input");
var nameForm = document.getElementById("name-form");
var nameInput = document.getElementById("name-input");
var nameDisplayRow = document.getElementById("name-display-row");
var nameDisplay = document.getElementById("name-display");
let logoutButton = document.getElementById("logout");
let usersOnlineDisplay = document.getElementById("users-online");

let nickname = "anonymous69";

messageForm.addEventListener("submit", function (e) {
  e.preventDefault();
  if (messageInput.value) {
    socket.emit("chat message", messageInput.value);
    messageInput.value = "";
  }
});

nameForm.addEventListener("submit", function (e) {
  e.preventDefault();
  if (nameInput.value) {
    nickname = nameInput.value;
    socket.emit("nickname", nickname);
    nameDisplayRow.style.display = "flex";
    nameDisplay.textContent = nickname;
    nameInput.value = "";
    nameForm.style.display = "none";
    messageForm.style.display = "flex";
  }
});

logoutButton.addEventListener("click", (e) => {
  messageForm.style.display = "none";
  nameForm.style.display = "flex";
  nameDisplay.textContent = "";
  nameDisplayRow.style.display = "none";
});

socket.on("chat", function ({ msg, nickname }) {
  var item = document.createElement("li");
  item.textContent = `${nickname}: ${msg}`;
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});

socket.on("user connected", function (usersOnline) {
  console.log("hello");
  usersOnlineDisplay.textContent = `${usersOnline} users online`;
});
socket.on("user disconnected", function (usersOnline) {
  usersOnlineDisplay.textContent = `${usersOnline} users online`;
});
