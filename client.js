// Client for lobby, chat, auth, visual table, multi-seat War, and auto-dealer
let socket;
let gameState = null;
let roomId = null;
let startingChips = 1000;
let auth = { authenticated: false, user: null };
// Multi-seat support: array of seat indices the user occupies
let mySeats = []; // Array of seat indices

async function fetchMe() {
  try { 
    const r = await fetch('/me'); 
    auth = await r.json(); 
    
    // Show avatar setup for new users
    if (auth.authenticated && auth.user.needsAvatarSetup) {
      setTimeout(() => openProfileModal(), 500);
    }
  } catch { 
    auth = { authenticated: false }; 
  }
  renderAuth();
}

async function logout() {
  try {
    await fetch('/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout failed:', err);
  }

  if (roomId && socket) {
    socket.emit('leave_room', { roomId });
  }

  auth = { authenticated: false, user: null };
  gameState = null;
  mySeats = [];
  roomId = null;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  renderAuth();
  showLobby();
}

function initSocket() {
  if (socket) return;
  socket = io();
  // Lobby
  socket.on('rooms_list', renderRooms);
  socket.on('rooms_update', renderRooms);
  socket.on('lobby_message', addLobbyMessage);
  socket.on('viewers_list', (viewers) => {
    const viewersList = document.getElementById('viewersList');
    if (viewersList) {
      viewersList.innerHTML = viewers.map(v => `
        <div class="viewer-item">
          <img src="${v.avatar}" class="viewer-avatar">
          <span class="viewer-name">${v.nickname}</span>
        </div>
      `).join('');
    }
  });

  socket.on('chat_history', (history) => {
    const chatBox = document.getElementById('lobbyChatBox');
    if (chatBox) {
      chatBox.innerHTML = '';
      history.forEach(addLobbyMessage);
    }
  });

  // Friends and invites
  socket.on('friend_request', handleFriendRequest);
  socket.on('table_invite', handleTableInvite);
  socket.on('invite_accepted', handleInviteAccepted);
  socket.on('chips_received', handleChipsReceived);
  // Room
  socket.on('room_created', (data) => { 
    roomId = data.roomId; 
    gameState = data.gameState; 
    startingChips = data.startingChips || 1000;
    mySeats = []; // Start as observer
    showGame(); 
    renderTable(); 
  });
  socket.on('room_joined', (data) => {
    roomId = data.roomId;
    gameState = data.gameState;
    startingChips = data.startingChips || 1000;
    mySeats = []; // Start as observer
    showGame();
    renderTable();
    playAnimation('newuser.001');
  });
  socket.on('observer_joined', (data) => { 
    gameState = data.gameState;
    renderTable(); 
  });
  socket.on('seat_taken', (data) => { 
    gameState = data.gameState;
    updateMySeats();
    renderTable(); 
  });
  socket.on('seat_left', (data) => { 
    gameState = data.gameState;
    updateMySeats();
    renderTable(); 
  });
  socket.on('game_state', (data) => { gameState = data.gameState; updateMySeats(); renderTable(); });
  socket.on('bet_placed', (data) => { gameState = data.gameState; renderTable(); });
  socket.on('bets_locked', (data) => { gameState = data.gameState; log("Bets locked"); renderTable(); });
  socket.on('cards_dealt', (data) => { gameState = data.gameState; renderTable(); playAnimation('Deal'); });
  socket.on('house_reveal', (data) => { gameState = data.gameState; log("House reveals card"); renderTable(); });
  socket.on('round_result', (data) => { gameState = data.gameState; showRoundResult(data.result); renderTable(); });
  socket.on('round_reset', (data) => { gameState = data.gameState; resetRoundUI(); renderTable(); });
  socket.on('game_over', (data) => { gameState = data.finalState; showGameOver(data.standings); });
  socket.on('room_message', addRoomMessage);
  socket.on('player_disconnected', (data) => { gameState = data.gameState; updateMySeats(); renderTable(); addRoomMessage({from:'System', msg:'A player disconnected', at:Date.now()}); });
  socket.on('error', (e) => alert(e.message));
  
  // Admin events
  socket.on('banned', (data) => {
    alert(`You have been banned. Reason: ${data.reason}`);
    window.location.href = '/';
  });
  
  socket.on('admin_broadcast', (data) => {
    showNotification(`📢 Admin Announcement: ${data.message}`);
  });
  
  socket.on('chat_filtered', (data) => {
    if (data.severity === 'low') {
      console.warn('Your message was filtered:', data.reason);
    } else {
      showNotification(`⚠️ ${data.reason}`);
    }
  });
}

// Update mySeats array based on current gameState
function updateMySeats() {
  if (!gameState || !socket) return;
  const mySocketId = socket.id;
  mySeats = [];
  gameState.seats.forEach((seat, i) => {
    if (!seat.empty && seat.socketId === mySocketId) {
      mySeats.push(i);
    }
  });
}

function renderAuth() {
  const btn = document.getElementById('loginBtn');
  const prof = document.getElementById('profile');
  const editBtn = document.getElementById('editProfileBtn');
  const adminBtn = document.getElementById('adminBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (auth.authenticated) {
    btn.style.display = 'none';
    prof.style.display = 'flex';
    prof.querySelector('img').src = auth.user.customAvatar || auth.user.photo || '';
    prof.querySelector('span').textContent = auth.user.nickname || auth.user.displayName;
    if (editBtn) editBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    
    // Show admin button if user is admin
    if (adminBtn && auth.user.isAdmin) {
      adminBtn.style.display = 'inline-block';
    }
    
    // Update global chip count
    const chipDisplay = document.getElementById('globalChipCount');
    if (chipDisplay) {
      chipDisplay.style.display = 'flex';
      chipDisplay.textContent = auth.user.chipBalance.toLocaleString();
    }
  } else {
    btn.style.display = 'inline-block';
    prof.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    
    const chipDisplay = document.getElementById('globalChipCount');
    if (chipDisplay) chipDisplay.style.display = 'none';
  }
}

// Avatar state
let currentAvatarTab = 'generated';
let currentAvatarSeed = null;
let currentAvatarStyle = 'adventurer';

// Profile editing
function openProfileModal() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('nicknameInput').value = auth.user?.nickname || auth.user?.displayName || '';
  
  // Check if user has custom avatar
  const customAvatar = auth.user?.customAvatar || '';
  if (customAvatar && !customAvatar.includes('api.dicebear.com')) {
    // Custom URL
    switchAvatarTab('custom');
    document.getElementById('avatarInput').value = customAvatar;
  } else {
    // Generated avatar - extract seed and style if available
    switchAvatarTab('generated');
    if (customAvatar.includes('api.dicebear.com')) {
      const urlMatch = customAvatar.match(/\/([^\/]+)\/svg\?seed=([^&]+)/);
      if (urlMatch) {
        currentAvatarStyle = urlMatch[1];
        currentAvatarSeed = urlMatch[2];
        document.getElementById('avatarStyle').value = currentAvatarStyle;
        document.getElementById('avatarSeed').value = currentAvatarSeed;
      }
    } else {
      // New avatar
      currentAvatarSeed = generateSeed();
      document.getElementById('avatarSeed').value = currentAvatarSeed;
    }
    updateAvatarPreview();
  }
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.style.display = 'none';
}

async function saveProfile() {
  const nickname = document.getElementById('nicknameInput').value.trim();
  let avatar = '';
  
  if (currentAvatarTab === 'custom') {
    avatar = document.getElementById('avatarInput').value.trim();
  } else {
    // Generated avatar
    const seed = document.getElementById('avatarSeed').value;
    const style = document.getElementById('avatarStyle').value;
    avatar = `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
  }
  
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

// Avatar functions
function switchAvatarTab(tab) {
  currentAvatarTab = tab;
  const tabs = document.querySelectorAll('.avatar-tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  if (tab === 'generated') {
    tabs[0].classList.add('active');
    document.getElementById('generatedTab').style.display = 'block';
    document.getElementById('customTab').style.display = 'none';
  } else {
    tabs[1].classList.add('active');
    document.getElementById('generatedTab').style.display = 'none';
    document.getElementById('customTab').style.display = 'block';
  }
}

function generateSeed() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function updateAvatarPreview() {
  const style = document.getElementById('avatarStyle').value;
  const seed = document.getElementById('avatarSeed').value || generateSeed();
  currentAvatarStyle = style;
  currentAvatarSeed = seed;
  
  document.getElementById('avatarSeed').value = seed;
  
  const previewEl = document.getElementById('avatarPreview');
  if (previewEl) {
    previewEl.innerHTML = `<img src="https://api.dicebear.com/9.x/${style}/svg?seed=${seed}" alt="Avatar Preview" class="avatar-preview-img" />`;
  }
}

function randomizeAvatar() {
  currentAvatarSeed = generateSeed();
  document.getElementById('avatarSeed').value = currentAvatarSeed;
  updateAvatarPreview();
}

// Lobby UI
function renderRooms(list) {
  const el = document.getElementById('rooms');
  el.innerHTML = '';
  if (!list || list.length === 0) { el.innerHTML = '<div class="empty">No active tables. Start the first game!</div>'; return; }
  list.forEach(r => {
    const div = document.createElement('div');
    div.className = 'room-card';
    
    let icon = '🃏';
    let name = 'War';
    
    div.innerHTML = `<div><div class="room-id">${icon} ${name} Table ${r.roomId.substring(0,6)}</div><div style="font-size:.9em;opacity:.8">${r.seatedCount} Players | ${r.observerCount} Watching</div></div><button class="btn btn-success">Join Table</button>`;
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
  row.innerHTML = `${m.photo?`<img class="avatar" src="${m.photo}">`:''}<b>${ClientCrypto.sanitize(m.from)}:</b> ${ClientCrypto.sanitize(m.msg)}`;
  box.appendChild(row); box.scrollTop = box.scrollHeight;
}

// Game UI
function createRoom() {
  initSocket();
  socket.emit('create_room', { startingChips: 1000 });
}
function joinRoom(id) {
  initSocket();
  socket.emit('join_room', { roomId: id });
}
function sendRoomChat() {
  const input = document.getElementById('roomChatInput'); const msg = input.value.trim(); if (!msg) return;
  socket.emit('room_chat', msg); input.value = '';
}
function addRoomMessage(m) {
  const box = document.getElementById('roomChatBox');
  const row = document.createElement('div'); row.className='chat-row';
  row.innerHTML = `${m.photo?`<img class="avatar" src="${m.photo}">`:''}<b>${ClientCrypto.sanitize(m.from)}:</b> ${ClientCrypto.sanitize(m.msg)}`;
  box.appendChild(row); box.scrollTop = box.scrollHeight;
}

async function claimDailyReward() {
  try {
    const res = await fetch('/api/daily-reward', { method: 'POST' });
    const data = await res.json();
    
    if (data.success) {
      alert(`🎁 Daily Reward Claimed!\n\n+${data.reward.chips} Chips\nStreak: ${data.reward.day} Days`);
      fetchMe(); // Refresh balance
    } else {
      if (data.nextClaimAt) {
        const next = new Date(data.nextClaimAt);
        const diff = next - new Date();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        alert(`⏳ Daily reward not ready yet.\n\nCome back in ${hours}h ${mins}m.`);
      } else {
        alert('❌ ' + (data.error || 'Failed to claim reward'));
      }
    }
  } catch (e) {
    console.error(e);
    alert('❌ Error claiming reward');
  }
}

// Sit at seat - now supports multi-seat
function sitAtSeat(seatIndex) {
  if (!socket) return;
  socket.emit('sit_at_seat', { seatIndex, chips: startingChips });
}

// Leave a specific seat
function leaveSeat(seatIndex) {
  if (!socket) return;
  socket.emit('leave_seat', { seatIndex });
}

// Place bet (simplified for single-seat mode)
function placeBet() {
  if (!gameState) return;

  // Find my seat
  const mySeatIndex = gameState.seats.findIndex(s => !s.empty && s.socketId === socket?.id);
  if (mySeatIndex === -1) {
    alert('Please sit at a seat first');
    return;
  }

  // Use currentBetAmount or fallback to old input field for compatibility
  let amt = currentBetAmount;
  const betInput = document.getElementById('betAmount');
  if (amt === 0 && betInput) {
    amt = Number(betInput.value);
  }

  if (isNaN(amt) || amt < gameState.minBet) {
    alert(`Minimum bet is $${gameState.minBet}`);
    return;
  }

  socket.emit('place_bet', { betAmount: amt, seatIndex: mySeatIndex });
  currentBetAmount = 0;
}

// Check if any of my seats need to bet
function hasUnreadySeats() {
  return mySeats.some(seatIndex => {
    const seat = gameState.seats[seatIndex];
    return seat && !seat.empty && !seat.ready;
  });
}

// Visual Table Rendering
// Modern renderTable for new UI
function renderTable() {
  if (!gameState) return;

  // Update status
  const statusEl = document.getElementById('tableStatus');
  if (statusEl) {
    statusEl.textContent = gameState.status || (gameState.bettingPhase ? 'Place your bets!' : '');
  }

  // Update pot display
  const potEl = document.getElementById('potDisplay');
  if (potEl) {
    potEl.textContent = `💰 Pot: $${gameState.pot}`;
  }

  // Render dealer area
  renderDealerModern();

  // Render 5 player spots
  for (let i = 0; i < 5; i++) {
    renderPlayerSpot(i);
  }

  // Update chip tray with player balance
  updateChipTray();

  // Show/hide betting controls
  updateBettingControls();
}

function renderHouse() {
  const houseEl = document.getElementById('houseArea');
  if (!houseEl) return;
  
  let cardsHtml = '';
  
  // Handle War house card
  if (gameState.houseCard) {
    const houseCard = gameState.houseCard;
    const isRed = houseCard.suit === '♥' || houseCard.suit === '♦';
    cardsHtml = `<div class="card dealt ${isRed ? 'red' : 'black'}">
      <span class="card-rank">${houseCard.rank}</span>
      <span class="card-suit">${houseCard.suit}</span>
    </div>`;
  } else {
    cardsHtml = '<div class="card card-back"><span class="dealer-icon">D</span></div>';
  }
  
  houseEl.innerHTML = `
    <div class="chip-tray">
      <div class="tray-chip red"></div>
      <div class="tray-chip red"></div>
      <div class="tray-chip green"></div>
      <div class="tray-chip green"></div>
      <div class="tray-chip black"></div>
      <div class="tray-chip black"></div>
      <div class="tray-chip blue"></div>
      <div class="tray-chip gold"></div>
    </div>
    <div class="house-label">DEALER ${gameState.dealerValue ? `(${gameState.dealerValue})` : ''}</div>
    <div class="house-card" style="display:flex; justify-content:center;">${cardsHtml}</div>
  `;
}

// Generate chip stack HTML based on bet amount
function renderChipStack(amount) {
  if (!amount || amount <= 0) return '';
  
  // Chip values: Black=100, Green=25, Red=5
  const chips = [];
  let remaining = amount;
  
  // Calculate chip breakdown
  const black = Math.floor(remaining / 100);
  remaining %= 100;
  const green = Math.floor(remaining / 25);
  remaining %= 25;
  const red = Math.ceil(remaining / 5);
  
  // Create chip elements (limit to 8 chips for display)
  let chipCount = 0;
  const maxChips = 8;
  
  for (let i = 0; i < Math.min(black, maxChips - chipCount); i++) {
    chips.push({ color: 'chip-black', offset: chipCount * 4 });
    chipCount++;
  }
  for (let i = 0; i < Math.min(green, maxChips - chipCount); i++) {
    chips.push({ color: 'chip-green', offset: chipCount * 4 });
    chipCount++;
  }
  for (let i = 0; i < Math.min(red, maxChips - chipCount); i++) {
    chips.push({ color: 'chip-red', offset: chipCount * 4 });
    chipCount++;
  }
  
  if (chips.length === 0) return '';
  
  const chipHtml = chips.map((c, i) => 
    `<div class="chip ${c.color}" style="bottom:${c.offset}px;z-index:${i}"></div>`
  ).join('');
  
  return `<div class="chip-stack">${chipHtml}</div>`;
}

function renderSeat(seatIndex) {
  const seatEl = document.getElementById(`seat${seatIndex}`);
  if (!seatEl) return;
  
  const seat = gameState.seats[seatIndex];
  const isMySeat = mySeats.includes(seatIndex);
  
  seatEl.className = `seat ${isMySeat ? 'my-seat' : ''} ${!seat.empty ? 'occupied' : 'empty'}`;
  
  if (seat.empty) {
    // Empty seat - show "Sit Here" button
    seatEl.innerHTML = `
      <button class="sit-btn" onclick="sitAtSeat(${seatIndex})">
        <span class="sit-icon">+</span>
        <span>Sit</span>
      </button>
    `;
  } else {
    // Occupied seat - show player info with chip stack
    let cardsHtml = '';
    
    // Handle War card
    if (seat.card) {
      const isRed = seat.card.suit === '♥' || seat.card.suit === '♦';
      cardsHtml = `<div class="card dealt ${isRed ? 'red' : 'black'}">
        <span class="card-rank">${seat.card.rank}</span>
        <span class="card-suit">${seat.card.suit}</span>
      </div>`;
    } else {
      cardsHtml = '<div class="card card-back"><span>?</span></div>';
    }
    
    const statusClass = seat.ready ? 'ready' : '';
    const disconnectedClass = !seat.connected ? 'disconnected' : '';
    const chipStackHtml = renderChipStack(seat.currentBet);
    
    seatEl.innerHTML = `
      ${seat.currentBet > 0 ? `<div class="betting-circle">${chipStackHtml}</div>` : ''}
      <div class="player-card ${statusClass} ${disconnectedClass}" style="display:flex; justify-content:center;">
        ${cardsHtml}
      </div>
      <div class="player-info">
        ${seat.photo ? `<img class="player-avatar" src="${seat.photo}" alt="">` : `<div class="player-avatar-placeholder">${seat.name.charAt(0).toUpperCase()}</div>`}
        <div class="player-name">${ClientCrypto.sanitize(seat.name)}</div>
        <div class="player-chips">$${seat.chips}</div>
        ${seat.currentBet > 0 ? `<div class="player-bet">Bet: $${seat.currentBet}</div>` : ''}
        ${!seat.connected ? '<div class="disconnected-label">Disconnected</div>' : ''}
      </div>
      ${isMySeat ? `<button class="leave-btn" onclick="leaveSeat(${seatIndex})">Leave</button>` : ''}
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
      div.innerHTML = `<span class="result-loss">House wins! Pot lost: $${res.pot}</span>`;
      playAnimation('Loser');
    } else {
      div.innerHTML = `<span class="result-win">${ClientCrypto.sanitize(winner.name)} wins $${res.pot}!</span>`;
    }
  } else {
    const names = res.winners.map(w => w.isHouse ? 'House' : ClientCrypto.sanitize(w.name)).join(', ');
    div.innerHTML = `<span class="result-tie">Tie between ${names}. Split pot $${res.pot}</span>`;
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
  div.innerHTML = `<span class="game-over">Game Over! Final standings: ${standings.map(s => `${ClientCrypto.sanitize(s.name)}: $${s.chips}`).join(', ')}</span>`;
  log('Game Over');
}

// ===== MODERN UI RENDERING FUNCTIONS =====

function renderDealerModern() {
  const dealerCardArea = document.getElementById('dealerCardArea');
  if (!dealerCardArea) return;

  let cardsHtml = '';

  // Handle War house card
  if (gameState.houseCard) {
    const houseCard = gameState.houseCard;
    const isRed = houseCard.suit === '♥' || houseCard.suit === '♦';
    cardsHtml = `<div class="card card-3d dealt ${isRed ? 'red' : 'black'}">
      <span class="card-rank">${houseCard.rank}</span>
      <span class="card-suit">${houseCard.suit}</span>
    </div>`;
  } else {
    cardsHtml = '<div class="card card-back card-3d"><span class="dealer-icon">🎴</span></div>';
  }

  dealerCardArea.innerHTML = cardsHtml;
}

function renderPlayerSpot(spotIndex) {
  const spotEl = document.getElementById(`playerSpot${spotIndex}`);
  if (!spotEl) return;

  const seat = gameState.seats[spotIndex];
  const mySocketId = socket ? socket.id : null;
  const isMySeat = !seat.empty && seat.socketId === mySocketId;

  // Update classes
  spotEl.className = `player-spot ${isMySeat ? 'my-spot' : ''} ${!seat.empty ? 'occupied' : 'empty'}`;

  if (seat.empty) {
    // Empty spot - show "Sit Here" button
    spotEl.innerHTML = `
      <button class="sit-here-btn" onclick="sitAtSeat(${spotIndex})">
        <span class="sit-icon-modern">+</span>
        <span>Sit Here</span>
      </button>
    `;
  } else {
    // Occupied spot - show player info
    let cardsHtml = '';

    // Handle cards
    if (seat.card) {
      // War card
      const isRed = seat.card.suit === '♥' || seat.card.suit === '♦';
      cardsHtml = `<div class="card card-3d dealt ${isRed ? 'red' : 'black'}">
        <span class="card-rank">${seat.card.rank}</span>
        <span class="card-suit">${seat.card.suit}</span>
      </div>`;
    }

    // Betting area with chips
    const bettingAreaHtml = `
      <div class="betting-area ${gameState.bettingPhase && isMySeat ? 'active' : ''}" id="bettingArea${spotIndex}">
        ${seat.currentBet > 0 ? renderChipStackVisual(seat.currentBet) : ''}
      </div>
    `;

    spotEl.innerHTML = `
      ${bettingAreaHtml}
      ${cardsHtml ? `<div class="player-card-area" style="margin-bottom:10px;">${cardsHtml}</div>` : ''}
      <div class="player-info-card">
        ${seat.photo ? `<img class="player-avatar-modern" src="${seat.photo}" alt="">` :
          `<div class="player-avatar-modern" style="background:#2d5a3d;display:flex;align-items:center;justify-content:center;font-size:1.5em;font-weight:700;color:#d4af37;">${seat.name.charAt(0).toUpperCase()}</div>`}
        <div class="player-name-modern">${ClientCrypto.sanitize(seat.name)}</div>
        <div class="player-chip-count">$${seat.chips}</div>
        ${seat.currentBet > 0 ? `<div style="font-size:0.85em;color:#4CAF50;">Bet: $${seat.currentBet}</div>` : ''}
        ${!seat.connected ? '<div style="color:#f44336;font-size:0.8em;">⚠ Disconnected</div>' : ''}
      </div>
      ${isMySeat ? `<button class="btn-modern btn-clear" style="margin-top:10px;padding:8px 16px;font-size:0.85em;" onclick="leaveSeat(${spotIndex})">Leave Seat</button>` : ''}
    `;
  }
}

function renderChipStackVisual(amount) {
  if (!amount || amount <= 0) return '';

  // Simple chip display (can be enhanced with stacking later)
  return `<div style="color:#d4af37;font-weight:700;font-size:1.1em;">$${amount}</div>`;
}

function updateChipTray() {
  const chipCountEl = document.getElementById('playerChipCount');
  if (chipCountEl && auth.authenticated) {
    // Find my seat to show current chips
    const mySeat = gameState.seats.find(s => !s.empty && s.socketId === socket?.id);
    if (mySeat) {
      chipCountEl.textContent = `$${mySeat.chips}`;
    } else if (auth.user) {
      chipCountEl.textContent = `$${auth.user.chipBalance || 1000}`;
    }
  }
}

function updateBettingControls() {
  const confirmBtn = document.getElementById('confirmBetBtn');
  const clearBtn = document.getElementById('clearBetBtn');

  // Check if player is seated and betting phase is active
  const mySeat = gameState.seats.find(s => !s.empty && s.socketId === socket?.id);
  const canBet = mySeat && gameState.bettingPhase && !mySeat.ready;

  if (confirmBtn && clearBtn) {
    if (canBet && currentBetAmount > 0) {
      confirmBtn.style.display = 'inline-block';
      clearBtn.style.display = 'inline-block';
    } else {
      confirmBtn.style.display = 'none';
      clearBtn.style.display = 'none';
    }
  }
}

// ===== CHIP BETTING SYSTEM =====

let currentBetAmount = 0;

// Initialize chip click handlers
function initChipClickHandlers() {
  const chipDenominations = document.querySelectorAll('.chip-denomination');
  chipDenominations.forEach(chipDenom => {
    const chipEl = chipDenom.querySelector('.draggable-chip');
    if (!chipEl) return;

    chipEl.addEventListener('click', () => {
      const value = parseInt(chipDenom.dataset.value);
      addChipToBet(value, chipEl);
    });
  });
}

function addChipToBet(value, chipEl) {
  // Check if player is seated
  if (!gameState) return;
  const mySeat = gameState.seats.find(s => !s.empty && s.socketId === socket?.id);
  if (!mySeat) {
    alert('Please sit at a table first!');
    return;
  }

  if (!gameState.bettingPhase) {
    alert('Betting phase is not active');
    return;
  }

  // Add to bet amount
  currentBetAmount += value;

  // Animate chip with anime.js
  if (typeof anime !== 'undefined') {
    anime({
      targets: chipEl,
      translateY: [0, -20, 0],
      scale: [1, 1.3, 1],
      duration: 500,
      easing: 'easeOutElastic(1, .6)'
    });
  }

  // Update UI
  updateBettingControls();
  showNotification(`Added $${value} to bet (Total: $${currentBetAmount})`);
}

function confirmBet() {
  if (currentBetAmount > 0) {
    placeBet();
    currentBetAmount = 0;
    updateBettingControls();
  }
}

function clearBet() {
  currentBetAmount = 0;
  updateBettingControls();
  renderTable();
  showNotification('Bet cleared');
}

// ===== CHAT TOGGLE =====

function toggleChat() {
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) {
    const isOpen = chatPanel.classList.toggle('open');
    document.body.classList.toggle('chat-open', isOpen);
  }
}

function showLobby() {
  // Leave the current room if in one
  if (roomId && socket) {
    socket.emit('leave_room', { roomId });
  }

  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) {
    chatPanel.classList.remove('open');
  }
  document.body.classList.remove('chat-open');

  const cardRoomClosed = document.getElementById('cardRoomClosed');
  if (cardRoomClosed.style.display !== 'block') {
    document.getElementById('lobbyScreen').style.display = 'block';
  }
  
  document.getElementById('gameScreen').style.display = 'none';
  mySeats = [];
  gameState = null;
  roomId = null;
  initSocket();
  socket.emit('get_rooms');
  if (auth.authenticated) {
    loadFriends();
    loadFriendRequests();
    loadInvites();
  }
  renderFriends(); // Update invite buttons
}

function showGame() {
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) {
    chatPanel.classList.remove('open');
  }
  document.body.classList.remove('chat-open');

  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'block';
  renderFriends(); // Update invite buttons
}

function log(msg) {
  const gl = document.getElementById('gameLog');
  if (!gl) return;
  const e = document.createElement('div');
  e.className = 'log-entry';
  e.textContent = `${new Date().toLocaleTimeString()} - ${msg}`;
  gl.prepend(e);
}

// Friends and Invites
let friends = [];
let friendRequests = [];
let tableInvites = [];

async function loadFriends() {
  try {
    const res = await fetch('/friends');
    const data = await res.json();
    friends = data.friends || [];
    renderFriends();
  } catch (e) {
    console.error('Error loading friends:', e);
  }
}

async function loadFriendRequests() {
  try {
    const res = await fetch('/friend-requests');
    const data = await res.json();
    friendRequests = data.requests || [];
    renderFriendRequests();
  } catch (e) {
    console.error('Error loading friend requests:', e);
  }
}

async function loadInvites() {
  try {
    const res = await fetch('/invites');
    const data = await res.json();
    tableInvites = data.invites || [];
    if (tableInvites.length > 0) {
      showInviteNotification();
    }
  } catch (e) {
    console.error('Error loading invites:', e);
  }
}

function renderFriends() {
  const list = document.getElementById('friendsList');
  if (!list) return;
  
  if (friends.length === 0) {
    list.innerHTML = '<div class="empty-state">No friends yet</div>';
    return;
  }
  
  list.innerHTML = friends.map(f => `
    <div class="friend-item">
      ${f.customAvatar ? `<img src="${f.customAvatar}" class="friend-avatar">` : '<div class="friend-avatar-placeholder">👤</div>'}
      <span class="friend-name">${ClientCrypto.sanitize(f.nickname || f.displayName)}</span>
      <div class="friend-actions">
        <button class="btn btn-small btn-transfer" onclick="openTransferModal('${f.id}', '${ClientCrypto.sanitize(f.nickname || f.displayName)}')">💰 Send</button>
        ${roomId ? `<button class="btn btn-small btn-invite" onclick="inviteFriend('${f.id}')">Invite</button>` : ''}
      </div>
    </div>
  `).join('');
}

function renderFriendRequests() {
  const container = document.getElementById('friendRequests');
  if (!container) return;
  
  if (friendRequests.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = `
    <div class="friend-requests-header">Friend Requests (${friendRequests.length})</div>
    ${friendRequests.map(req => `
      <div class="friend-request-item">
        ${req.user.customAvatar ? `<img src="${req.user.customAvatar}" class="friend-avatar">` : '<div class="friend-avatar-placeholder">👤</div>'}
        <span class="friend-name">${ClientCrypto.sanitize(req.user.nickname || req.user.displayName)}</span>
        <div class="friend-request-actions">
          <button class="btn btn-small btn-success" onclick="acceptFriendRequest('${req.id}')">✓</button>
          <button class="btn btn-small btn-danger" onclick="declineFriendRequest('${req.id}')">✗</button>
        </div>
      </div>
    `).join('')}
  `;
}

function openAddFriendModal() {
  document.getElementById('addFriendModal').style.display = 'flex';
  document.getElementById('friendEmail').value = '';
}

function closeAddFriendModal() {
  document.getElementById('addFriendModal').style.display = 'none';
}

async function sendFriendRequest() {
  const email = document.getElementById('friendEmail').value.trim();
  if (!email) return;
  
  try {
    const res = await fetch('/friend-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendEmail: email })
    });
    const data = await res.json();
    
    if (data.ok) {
      alert('Friend request sent!');
      closeAddFriendModal();
    } else {
      alert(data.error || 'Failed to send request');
    }
  } catch (e) {
    alert('Error sending friend request');
  }
}

async function acceptFriendRequest(requestId) {
  try {
    const res = await fetch(`/friend-request/${requestId}/accept`, { method: 'POST' });
    const data = await res.json();
    
    if (data.ok) {
      await loadFriends();
      await loadFriendRequests();
    }
  } catch (e) {
    console.error('Error accepting friend request:', e);
  }
}

async function declineFriendRequest(requestId) {
  try {
    const res = await fetch(`/friend-request/${requestId}/decline`, { method: 'POST' });
    const data = await res.json();
    
    if (data.ok) {
      await loadFriendRequests();
    }
  } catch (e) {
    console.error('Error declining friend request:', e);
  }
}

function inviteFriend(friendId) {
  if (!socket || !roomId) return;
  socket.emit('send_invite', { friendId });
  alert('Invite sent!');
}

function handleFriendRequest(data) {
  loadFriendRequests();
  showNotification(`Friend request from ${data.from.nickname || data.from.displayName}`);
}

function handleTableInvite(data) {
  tableInvites.push(data);
  showNotification(`${data.from.name} invited you to a table!`);
  openInvitesModal();
}

function handleInviteAccepted(data) {
  roomId = data.roomId;
  gameState = data.gameState;
  showGame();
  renderTable();
  closeInvitesModal();
}

function openInvitesModal() {
  const modal = document.getElementById('invitesModal');
  const list = document.getElementById('invitesList');
  
  if (tableInvites.length === 0) {
    list.innerHTML = '<div class="empty-state">No pending invites</div>';
  } else {
    list.innerHTML = tableInvites.map(inv => `
      <div class="invite-item">
        <div>
          ${inv.from.photo ? `<img src="${inv.from.photo}" class="invite-avatar">` : '<div class="invite-avatar-placeholder">👤</div>'}
          <span>${ClientCrypto.sanitize(inv.from.name)} invited you to Table ${inv.roomId}</span>
        </div>
        <div class="invite-actions">
          <button class="btn btn-success" onclick="acceptInvite('${inv.inviteId}')">Join</button>
          <button class="btn" onclick="declineInvite('${inv.inviteId}')">Decline</button>
        </div>
      </div>
    `).join('');
  }
  
  modal.style.display = 'flex';
}

function closeInvitesModal() {
  document.getElementById('invitesModal').style.display = 'none';
}

function acceptInvite(inviteId) {
  if (!socket) return;
  socket.emit('accept_invite', { inviteId });
}

function declineInvite(inviteId) {
  tableInvites = tableInvites.filter(inv => inv.inviteId !== inviteId);
  openInvitesModal();
}

function showNotification(message) {
  // Simple notification - could be enhanced with a proper notification system
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = message;
  document.body.appendChild(notif);
  
  setTimeout(() => {
    notif.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

function showInviteNotification() {
  showNotification(`You have ${tableInvites.length} table invite(s)!`);
}

// Chip Transfer
let transferTargetId = null;
let transferTargetName = null;

function openTransferModal(friendId, friendName) {
  transferTargetId = friendId;
  transferTargetName = friendName;
  
  const modal = document.getElementById('transferModal');
  document.getElementById('transferRecipient').textContent = friendName;
  document.getElementById('transferAmount').value = '100';
  document.getElementById('transferBalance').textContent = auth.user?.chipBalance || 0;
  modal.style.display = 'flex';
}

function closeTransferModal() {
  document.getElementById('transferModal').style.display = 'none';
  transferTargetId = null;
  transferTargetName = null;
}

async function sendChips() {
  const amount = Number(document.getElementById('transferAmount').value);
  
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }
  
  if (amount < 10) {
    alert('Minimum transfer is 10 chips');
    return;
  }
  
  if (amount > auth.user?.chipBalance) {
    alert('Insufficient chips');
    return;
  }
  
  try {
    const res = await fetch('/transfer-chips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId: transferTargetId, amount })
    });
    const data = await res.json();
    
    if (data.ok) {
      auth.user.chipBalance = data.newBalance;
      renderAuth();
      showNotification(`✅ Sent ${amount} chips to ${transferTargetName}!`);
      closeTransferModal();
      
      // Refresh chip display
      const chipDisplay = document.getElementById('chipDisplay');
      if (chipDisplay) {
        chipDisplay.textContent = `$${data.newBalance}`;
      }
    } else {
      alert(data.error || 'Failed to send chips');
    }
  } catch (e) {
    alert('Error sending chips');
  }
}

function handleChipsReceived(data) {
  auth.user.chipBalance = data.newBalance;
  renderAuth();
  showNotification(`💰 ${data.from.name} sent you ${data.amount} chips!`);
  
  // Update chip display
  const chipDisplay = document.getElementById('chipDisplay');
  if (chipDisplay) {
    chipDisplay.textContent = `$${data.newBalance}`;
  }
  
  // Refresh user data
  fetchMe();
}

// ========== INFO MODAL FUNCTIONALITY ==========

let currentInfoTab = 'rules';

function openInfoModal() {
  document.getElementById('infoModal').style.display = 'flex';
  showInfoTab('rules');
}

function closeInfoModal() {
  document.getElementById('infoModal').style.display = 'none';
}

function showInfoTab(tabName) {
  currentInfoTab = tabName;
  
  // Update tab buttons
  const tabs = document.querySelectorAll('.info-tab-btn');
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Show selected content
  const contents = document.querySelectorAll('.info-tab-content');
  contents.forEach(content => {
    if (content.dataset.tab === tabName) {
      content.style.display = 'block';
    } else {
      content.style.display = 'none';
    }
  });
}

async function submitTip() {
  const amount = Number(document.getElementById('tipAmount').value);
  const note = document.getElementById('tipNote').value;
  
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }
  
  if (amount < 1) {
    alert('Minimum tip is 1 chip');
    return;
  }
  
  try {
    const response = await fetch('/api/tip-moe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, note })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      auth.user.chipBalance = data.newBalance;
      renderAuth();
      alert(data.message);
      document.getElementById('tipAmount').value = '';
      document.getElementById('tipNote').value = '';
      closeInfoModal();
    } else {
      alert(data.error || 'Failed to send tip');
    }
  } catch (e) {
    console.error('Tip error:', e);
    alert('Error sending tip');
  }
}

async function checkCardRoomStatus() {
  try {
    const response = await fetch('/api/card-room-status');
    const status = await response.json();

    if (!status.isOpen && (!auth.authenticated || !auth.user.isAdmin)) {
      const lobbyScreen = document.getElementById('lobbyScreen');
      const cardRoomClosed = document.getElementById('cardRoomClosed');
      if (lobbyScreen) lobbyScreen.style.display = 'none';
      if (cardRoomClosed) cardRoomClosed.style.display = 'block';
    }
  } catch (error) {
    console.error('Error checking card room status:', error);
  }
}

window.addEventListener('load', async () => {
  await fetchMe();
  await checkCardRoomStatus();
  showLobby();
  initSocket();
  initChipClickHandlers(); // Initialize chip betting system

  if (auth.authenticated) {
    loadFriends();
    loadFriendRequests();
    loadInvites();
  }
});