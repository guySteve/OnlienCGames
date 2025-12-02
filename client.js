// Client for lobby, chat, auth, visual table, and auto-dealer War
let socket;
let gameState = null;
let roomId = null;
let startingChips = 1000;
let auth = { authenticated: false, user: null };
let mySeatIndex = -1; // -1 means observer

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
  socket.on('room_created', (data) => { 
    roomId = data.roomId; 
    gameState = data.gameState; 
    startingChips = data.startingChips || 1000;
    mySeatIndex = -1; // Start as observer
    showGame(); 
    renderTable(); 
  });
  socket.on('observer_joined', (data) => { 
    gameState = data.gameState; 
    renderTable(); 
  });
  socket.on('seat_taken', (data) => { 
    gameState = data.gameState;
    // Check if it's our seat using findIndex for early exit
    const mySocketId = socket.id;
    const foundSeatIndex = gameState.seats.findIndex(seat => !seat.empty && seat.socketId === mySocketId);
    if (foundSeatIndex !== -1) {
      mySeatIndex = foundSeatIndex;
    }
    renderTable(); 
  });
  socket.on('seat_left', (data) => { 
    gameState = data.gameState;
    // Check if we're still seated using findIndex
    const mySocketId = socket.id;
    const foundSeatIndex = gameState.seats.findIndex(seat => !seat.empty && seat.socketId === mySocketId);
    if (foundSeatIndex === -1) mySeatIndex = -1;
    renderTable(); 
  });
  socket.on('game_state', (data) => { gameState = data.gameState; renderTable(); });
  socket.on('bet_placed', (data) => { gameState = data.gameState; renderTable(); });
  socket.on('bets_locked', (data) => { gameState = data.gameState; log("Bets locked"); renderTable(); });
  socket.on('cards_dealt', (data) => { gameState = data.gameState; renderTable(); });
  socket.on('house_reveal', (data) => { gameState = data.gameState; log("House reveals card"); renderTable(); });
  socket.on('round_result', (data) => { gameState = data.gameState; showRoundResult(data.result); renderTable(); });
  socket.on('round_reset', (data) => { gameState = data.gameState; resetRoundUI(); renderTable(); });
  socket.on('game_over', (data) => { gameState = data.finalState; showGameOver(data.standings); });
  socket.on('room_message', addRoomMessage);
  socket.on('player_disconnected', (data) => { gameState = data.gameState; renderTable(); addRoomMessage({from:'System', msg:'A player disconnected', at:Date.now()}); });
  socket.on('error', (e) => alert(e.message));
}

function renderAuth() {
  const btn = document.getElementById('loginBtn');
  const prof = document.getElementById('profile');
  const editBtn = document.getElementById('editProfileBtn');
  if (auth.authenticated) {
    btn.style.display = 'none';
    prof.style.display = 'flex';
    prof.querySelector('img').src = auth.user.customAvatar || auth.user.photo || '';
    prof.querySelector('span').textContent = auth.user.nickname || auth.user.displayName;
    if (editBtn) editBtn.style.display = 'inline-block';
  } else {
    btn.style.display = 'inline-block';
    prof.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
  }
}

// Profile editing
function openProfileModal() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('nicknameInput').value = auth.user?.nickname || auth.user?.displayName || '';
  document.getElementById('avatarInput').value = auth.user?.customAvatar || '';
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.style.display = 'none';
}

async function saveProfile() {
  const nickname = document.getElementById('nicknameInput').value.trim();
  const avatar = document.getElementById('avatarInput').value.trim();
  try {
    const res = await fetch('/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, avatar })
    });
    const data = await res.json();
    if (data.ok) {
      auth.user.nickname = data.profile.nickname;
      auth.user.customAvatar = data.profile.avatar;
      renderAuth();
      closeProfileModal();
    } else {
      alert(data.error || 'Failed to save profile');
    }
  } catch (e) {
    alert('Error saving profile');
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
    div.innerHTML = `<div><div class="room-id">Table ${r.roomId}</div><div style="font-size:.9em;opacity:.8">${r.seatedCount}/5 Seated | ${r.observerCount} Watching</div></div><button class="btn btn-success">Join Table</button>`;
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
  startingChips = Number(document.getElementById('startingChips').value) || 1000;
  socket.emit('create_room', { startingChips });
}
function joinRoom(id) {
  initSocket();
  startingChips = Number(document.getElementById('startingChips').value) || 1000;
  socket.emit('join_room', { roomId: id, startingChips });
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

// Sit at seat
function sitAtSeat(seatIndex) {
  if (!socket || mySeatIndex !== -1) return;
  socket.emit('sit_at_seat', { seatIndex, chips: startingChips });
}

// Leave seat
function leaveSeat() {
  if (!socket || mySeatIndex === -1) return;
  socket.emit('leave_seat');
}

function placeBet() {
  const amt = Number(document.getElementById('betAmount').value);
  if (!gameState) return; 
  if (mySeatIndex === -1) { alert('Please sit at a seat first'); return; }
  if (isNaN(amt) || amt < gameState.minBet) { alert(`Min bet ${gameState.minBet}`); return; }
  socket.emit('place_bet', { betAmount: amt });
}

// Visual Table Rendering
function renderTable() {
  if (!gameState) return;
  
  const tableEl = document.getElementById('casinoTable');
  if (!tableEl) return;
  
  // Update status
  const statusEl = document.getElementById('tableStatus');
  if (statusEl) {
    statusEl.textContent = gameState.status || (gameState.bettingPhase ? 'Place your bets!' : '');
  }
  
  // Update pot display
  const potEl = document.getElementById('potDisplay');
  if (potEl) {
    potEl.textContent = `Pot: ${gameState.pot} | Min bet: ${gameState.minBet}`;
  }
  
  // Render house/dealer area
  renderHouse();
  
  // Render 5 seats
  for (let i = 0; i < 5; i++) {
    renderSeat(i);
  }
  
  // Update betting controls visibility
  const bettingControls = document.getElementById('bettingControls');
  if (bettingControls) {
    if (mySeatIndex >= 0 && gameState.bettingPhase) {
      const mySeat = gameState.seats[mySeatIndex];
      if (mySeat && !mySeat.empty && !mySeat.ready) {
        bettingControls.style.display = 'flex';
      } else {
        bettingControls.style.display = 'none';
      }
    } else {
      bettingControls.style.display = 'none';
    }
  }
  
  // Update observer count
  const observerEl = document.getElementById('observerCount');
  if (observerEl) {
    observerEl.textContent = `${gameState.observerCount} watching`;
  }
}

function renderHouse() {
  const houseEl = document.getElementById('houseArea');
  if (!houseEl) return;
  
  const houseCard = gameState.houseCard;
  let cardHtml = '<div class="card card-back"><span class="dealer-icon">D</span></div>';
  
  if (houseCard) {
    const isRed = houseCard.suit === '♥' || houseCard.suit === '♦';
    cardHtml = `<div class="card ${isRed ? 'red' : 'black'}">
      <span class="card-rank">${houseCard.rank}</span>
      <span class="card-suit">${houseCard.suit}</span>
    </div>`;
  }
  
  houseEl.innerHTML = `
    <div class="house-label">DEALER</div>
    <div class="house-card">${cardHtml}</div>
  `;
}

function renderSeat(seatIndex) {
  const seatEl = document.getElementById(`seat${seatIndex}`);
  if (!seatEl) return;
  
  const seat = gameState.seats[seatIndex];
  const isMe = mySeatIndex === seatIndex;
  
  seatEl.className = `seat ${isMe ? 'my-seat' : ''} ${!seat.empty ? 'occupied' : 'empty'}`;
  
  if (seat.empty) {
    // Empty seat - show "Sit Here" button
    seatEl.innerHTML = `
      <button class="sit-btn" onclick="sitAtSeat(${seatIndex})">
        <span class="sit-icon">+</span>
        <span>Sit Here</span>
      </button>
    `;
  } else {
    // Occupied seat - show player info
    let cardHtml = '<div class="card card-back"><span>?</span></div>';
    
    if (seat.card) {
      const isRed = seat.card.suit === '♥' || seat.card.suit === '♦';
      cardHtml = `<div class="card ${isRed ? 'red' : 'black'}">
        <span class="card-rank">${seat.card.rank}</span>
        <span class="card-suit">${seat.card.suit}</span>
      </div>`;
    }
    
    const statusClass = seat.ready ? 'ready' : '';
    const disconnectedClass = !seat.connected ? 'disconnected' : '';
    
    seatEl.innerHTML = `
      <div class="player-card ${statusClass} ${disconnectedClass}">
        ${cardHtml}
      </div>
      <div class="player-info">
        ${seat.photo ? `<img class="player-avatar" src="${seat.photo}" alt="">` : '<div class="player-avatar-placeholder">P</div>'}
        <div class="player-name">${escapeHtml(seat.name)}</div>
        <div class="player-chips">$ ${seat.chips}</div>
        ${seat.currentBet > 0 ? `<div class="player-bet">Bet: ${seat.currentBet}</div>` : ''}
        ${!seat.connected ? '<div class="disconnected-label">Disconnected</div>' : ''}
      </div>
      ${isMe ? '<button class="leave-btn" onclick="leaveSeat()">Leave Seat</button>' : ''}
    `;
  }
}

function showRoundResult(res) {
  const div = document.getElementById('roundResult');
  if (!div) return;
  div.style.display = 'block';
  
  if (res.type === 'win') {
    const winner = res.winners[0];
    if (winner.isHouse) {
      div.innerHTML = `<span class="result-loss">House wins! Pot lost: ${res.pot}</span>`;
    } else {
      div.innerHTML = `<span class="result-win">${escapeHtml(winner.name)} wins ${res.pot}!</span>`;
    }
  } else {
    const names = res.winners.map(w => w.isHouse ? 'House' : escapeHtml(w.name)).join(', ');
    div.innerHTML = `<span class="result-tie">Tie between ${names}. Split pot ${res.pot}</span>`;
  }
  log(div.textContent);
}

function resetRoundUI() {
  const div = document.getElementById('roundResult');
  if (div) div.style.display = 'none';
}

function showGameOver(standings) {
  const div = document.getElementById('roundResult');
  if (!div) return;
  div.style.display = 'block';
  div.innerHTML = `<span class="game-over">Game Over! Final standings: ${standings.map(s => `${escapeHtml(s.name)}: ${s.chips}`).join(', ')}</span>`;
  log('Game Over');
}

function showLobby() {
  document.getElementById('lobbyScreen').style.display = 'block';
  document.getElementById('gameScreen').style.display = 'none';
  mySeatIndex = -1;
  gameState = null;
  roomId = null;
  initSocket(); socket.emit('get_rooms');
}

function showGame() {
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'block';
}

function log(msg) {
  const gl = document.getElementById('gameLog');
  if (!gl) return;
  const e = document.createElement('div');
  e.className = 'log-entry';
  e.textContent = `${new Date().toLocaleTimeString()} - ${msg}`;
  gl.prepend(e);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

window.addEventListener('load', () => { fetchMe(); showLobby(); initSocket(); });