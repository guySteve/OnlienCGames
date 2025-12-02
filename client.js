// Client for lobby, chat, auth, and auto-dealer War
let socket;
let gameState = null;
let roomId = null;
let auth = { authenticated: false, user: null };

async function fetchMe() {
  try { const r = await fetch('/me'); auth = await r.json(); } catch { auth = { authenticated: false }; }
  renderAuth();
}

function initSocket() {
  if (socket) return;
  socket = io();
  // Lobby
  socket.on('rooms_list', renderRooms);
  socket.on('rooms_update', renderRooms);
  socket.on('lobby_message', addLobbyMessage);
  // Room
  socket.on('room_created', (data) => { roomId = data.roomId; gameState = data.gameState; showGame(); renderGame(); });
  socket.on('player_joined', (data) => { gameState = data.gameState; renderGame(); });
  socket.on('bet_placed', (data) => { gameState = data.gameState; renderGame(); });
  socket.on('bets_locked', (data) => { gameState = data.gameState; log("Bets locked"); renderGame(); });
  socket.on('cards_dealt', (data) => { gameState = data.gameState; renderCards(); });
  socket.on('round_result', (data) => { gameState = data.gameState; showRoundResult(data.result); renderGame(); });
  socket.on('round_reset', (data) => { gameState = data.gameState; resetRoundUI(); renderGame(); });
  socket.on('game_over', (data) => { gameState = data.finalState; showGameOver(data.standings); });
  socket.on('room_message', addRoomMessage);
  socket.on('player_disconnected', (data) => { gameState = data.gameState; renderGame(); addRoomMessage({from:'System', msg:'Opponent disconnected', at:Date.now()}); });
  socket.on('error', (e) => alert(e.message));
}

function renderAuth() {
  const btn = document.getElementById('loginBtn');
  const prof = document.getElementById('profile');
  if (auth.authenticated) {
    btn.style.display = 'none';
    prof.style.display = 'flex';
    prof.querySelector('img').src = auth.user.photo || '';
    prof.querySelector('span').textContent = auth.user.displayName;
  } else {
    btn.style.display = 'inline-block';
    prof.style.display = 'none';
  }
}

// Lobby UI
function renderRooms(list) {
  const el = document.getElementById('rooms');
  el.innerHTML = '';
  if (!list || list.length === 0) { el.innerHTML = '<div class="empty">No active tables. Start the first War!</div>'; return; }
  list.forEach(r => {
    const div = document.createElement('div');
    div.className = 'room-card';
    div.innerHTML = `<div><div class="room-id">Table ${r.roomId}</div><div style="font-size:.9em;opacity:.8">${r.playerCount}/2 Players</div></div><button ${r.hasRoom ? '' : 'disabled'} class="btn btn-success">Join Table</button>`;
    div.querySelector('button').onclick = () => joinRoom(r.roomId);
    el.appendChild(div);
  });
}
function sendLobbyChat() {
  const input = document.getElementById('lobbyChatInput');
  const msg = input.value.trim(); if (!msg) return;
  socket.emit('lobby_chat', msg); input.value = '';
}
function addLobbyMessage(m) {
  const box = document.getElementById('lobbyChatBox');
  const row = document.createElement('div'); row.className='chat-row';
  row.innerHTML = `${m.photo?`<img class="avatar" src="${m.photo}">`:''}<b>${escapeHtml(m.from)}:</b> ${escapeHtml(m.msg)}`;
  box.appendChild(row); box.scrollTop = box.scrollHeight;
}

// Game UI
function createRoom() {
  initSocket();
  const startingChips = Number(document.getElementById('startingChips').value) || 1000;
  socket.emit('create_room', { startingChips });
}
function joinRoom(id) {
  initSocket();
  socket.emit('join_room', { roomId: id, startingChips: Number(document.getElementById('startingChips').value)||1000 });
}
function sendRoomChat() {
  const input = document.getElementById('roomChatInput'); const msg = input.value.trim(); if (!msg) return;
  socket.emit('room_chat', msg); input.value = '';
}
function addRoomMessage(m) {
  const box = document.getElementById('roomChatBox');
  const row = document.createElement('div'); row.className='chat-row';
  row.innerHTML = `${m.photo?`<img class="avatar" src="${m.photo}">`:''}<b>${escapeHtml(m.from)}:</b> ${escapeHtml(m.msg)}`;
  box.appendChild(row); box.scrollTop = box.scrollHeight;
}

function placeBet() {
  const amt = Number(document.getElementById('betAmount').value);
  if (!gameState) return; if (isNaN(amt) || amt < gameState.minBet) { alert(`Min bet ${gameState.minBet}`); return; }
  socket.emit('place_bet', { betAmount: amt });
}

function renderGame() {
  if (!gameState) return;
  document.getElementById('minBet').textContent = gameState.minBet;
  document.getElementById('potAmount').textContent = gameState.pot;
  const p1 = gameState.players.find(p=>p.key==='p1');
  const p2 = gameState.players.find(p=>p.key==='p2');
  renderPlayer('p1', p1);
  renderPlayer('p2', p2);
}
function renderPlayer(k, p) {
  const nameEl = document.getElementById(`${k}Name`);
  const chipsEl = document.getElementById(`${k}Chips`);
  const imgEl = document.getElementById(`${k}Avatar`);
  const betEl = document.getElementById(`${k}Bet`);
  if (!p) { nameEl.textContent='Waiting...'; chipsEl.textContent=''; imgEl.src=''; betEl.textContent=''; return; }
  nameEl.textContent = p.name;
  chipsEl.textContent = `💰 ${p.chips}`;
  imgEl.src = p.photo || '';
  betEl.textContent = p.currentBet>0?`Bet: ${p.currentBet}`:'';
}
function renderCards() {
  const p1 = gameState.players.find(p=>p.key==='p1');
  const p2 = gameState.players.find(p=>p.key==='p2');
  if (p1?.card) document.getElementById('p1Card').innerHTML = `<div>${p1.card.rank}${p1.card.suit}</div>`;
  if (p2?.card) document.getElementById('p2Card').innerHTML = `<div>${p2.card.rank}${p2.card.suit}</div>`;
}
function showRoundResult(res) {
  const div = document.getElementById('roundResult');
  div.style.display='block';
  if (res.type==='win') div.textContent = `${res.winners[0].name} wins ${res.pot}!`;
  else div.textContent = `Tie. Split pot ${res.pot}`;
  log(div.textContent);
}
function resetRoundUI() {
  document.getElementById('roundResult').style.display='none';
  document.getElementById('p1Card').innerHTML = '<div class="card-back"></div>';
  document.getElementById('p2Card').innerHTML = '<div class="card-back"></div>';
}
function showLobby() {
  document.getElementById('lobbyScreen').style.display='block';
  document.getElementById('gameScreen').style.display='none';
  initSocket(); socket.emit('get_rooms');
}
function showGame() {
  document.getElementById('lobbyScreen').style.display='none';
  document.getElementById('gameScreen').style.display='block';
}
function log(msg){ const gl=document.getElementById('gameLog'); const e=document.createElement('div'); e.className='log-entry'; e.textContent=`${new Date().toLocaleTimeString()} - ${msg}`; gl.prepend(e); }

function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

window.addEventListener('load', () => { fetchMe(); showLobby(); initSocket(); });