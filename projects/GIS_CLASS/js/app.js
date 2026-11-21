/**
 * app.js - Unified Live Session Application Logic
 * Supports Host & Participant modes, WebRTC via PeerJS, knock-to-enter,
 * universal chat, hand raising, screen sharing, and local recording.
 */

// Parse URL Parameters
const urlParams = new URLSearchParams(window.location.search);
const roomCode = (urlParams.get('room') || 'DEMO-ROOM').toUpperCase().replace(/[^A-Z0-9-]/g, '');
const isHost = urlParams.get('role') === 'host';
const sessionTitle = urlParams.get('title') || 'Interactive Live Session';

// State
let myName = isHost ? 'Host' : '';
let localStream = null;
let screenStream = null;
let peer = null;
let myPeerId = '';
const hostPeerId = `session-${roomCode}-host`;

// Connections State
const waitingList = {}; // peerId -> { conn, name }
const connectedPeers = {}; // peerId -> { conn, call, name, handRaised }
let activeKnockId = null; // for floating alert banner

// Media & Feature States
let isMicMuted = false;
let isCamOff = false;
let isScreenSharing = false;
let isHandRaised = false;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let recTimerInterval = null;
let recSeconds = 0;
let unreadChatCount = 0;

// Host Session Timing & Tracking
let sessionStartTime = null;
let sessionStartTimestamp = Date.now();

// UI Elements
const headerSessionTitle = document.getElementById('header-session-title');
const headerRoomCode = document.getElementById('header-room-code');
const headerRoleBadge = document.getElementById('header-role-badge');
const recIndicator = document.getElementById('rec-indicator');
const recTimer = document.getElementById('rec-timer');
const videoGrid = document.getElementById('video-grid');

// Controls
const btnToggleMic = document.getElementById('btn-toggle-mic');
const iconMic = document.getElementById('icon-mic');
const btnToggleCam = document.getElementById('btn-toggle-cam');
const iconCam = document.getElementById('icon-cam');
const btnScreenShare = document.getElementById('btn-share-screen') || document.getElementById('btn-screen-share');
const btnRecordSession = document.getElementById('btn-record-session');
const btnWaitingRoom = document.getElementById('btn-waiting-room');
const badgeWaitingCount = document.getElementById('badge-knock-count') || document.getElementById('badge-waiting-count');
const btnRaiseHand = document.getElementById('btn-raise-hand');
const btnViewHands = document.getElementById('btn-view-hands');
const badgeHandsCount = document.getElementById('badge-hands-count');
const btnToggleChat = document.getElementById('btn-toggle-chat');
const badgeChatUnread = document.getElementById('badge-chat-unread');
const btnLeaveCall = document.getElementById('btn-leave-call');

// Drawers
const chatDrawer = document.getElementById('chat-drawer');
const btnCloseChat = document.getElementById('btn-close-chat');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const waitingDrawer = document.getElementById('waiting-drawer');
const btnCloseWaiting = document.getElementById('btn-close-waiting');
const knockList = document.getElementById('knock-list');
const emptyWaitingMsg = document.getElementById('empty-waiting-msg');
const waitingDrawerCount = document.getElementById('waiting-drawer-count');

const handsDrawer = document.getElementById('hands-drawer');
const btnCloseHands = document.getElementById('btn-close-hands');
const handsList = document.getElementById('hands-list');
const emptyHandsMsg = document.getElementById('empty-hands-msg');
const handsDrawerCount = document.getElementById('hands-drawer-count');

// Floating Knock Alert
const floatingKnockAlert = document.getElementById('floating-knock-alert');
const floatingKnockName = document.getElementById('floating-knock-name');
const btnFloatingAdmit = document.getElementById('btn-floating-admit');
const btnFloatingDeny = document.getElementById('btn-floating-deny');

// Lobby Elements (for participants)
const lobbyModal = document.getElementById('lobby-modal');
const lobbyPrejoinCard = document.getElementById('lobby-prejoin-card');
const lobbyWaitingCard = document.getElementById('lobby-waiting-card');
const lobbyDeniedCard = document.getElementById('lobby-denied-card');
const lobbySessionTitle = document.getElementById('lobby-session-title');
const lobbyVideoPreview = document.getElementById('lobby-video-preview');
const lobbyAvatar = document.getElementById('lobby-avatar');
const btnLobbyMic = document.getElementById('btn-lobby-mic');
const lobbyMicIcon = document.getElementById('lobby-mic-icon');
const btnLobbyCam = document.getElementById('btn-lobby-cam');
const lobbyCamIcon = document.getElementById('lobby-cam-icon');
const participantNameInput = document.getElementById('participant-name-input');
const btnRequestJoin = document.getElementById('btn-request-join');
const btnCancelKnock = document.getElementById('btn-cancel-knock');
const btnRetryKnock = document.getElementById('btn-retry-knock');
const toast = document.getElementById('toast');

// STUN Servers for WebRTC NAT traversal across networks & mobile data
const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  }
};

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// -----------------------------------------------------------------------------
// App Initialization
// -----------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  headerSessionTitle.textContent = sessionTitle;
  headerRoomCode.textContent = roomCode;

  if (isHost) {
    headerRoleBadge.textContent = 'Host';
    headerRoleBadge.classList.add('host');
    document.querySelectorAll('.host-only').forEach(el => el.style.display = 'flex');
    document.querySelectorAll('.participant-only').forEach(el => el.style.display = 'none');
    
    // Host joins immediately
    await startMediaAndHost();
  } else {
    headerRoleBadge.textContent = 'Participant';
    headerRoleBadge.classList.add('participant');
    document.querySelectorAll('.host-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.participant-only').forEach(el => el.style.display = 'flex');

    // Auto-reconnect if participant refreshed the page during a live call!
    const savedName = sessionStorage.getItem('admitted_name_' + roomCode);
    if (savedName) {
      myName = savedName;
      lobbySessionTitle.textContent = sessionTitle;
      // Keep lobby modal hidden so participant stays right in the conference room!
      lobbyModal.style.display = 'none';
      showToast('Reconnecting to live session...');
      showReconnectingBanner(true, 'Re-linking to live session...');
      await startLobbyPreview();
      createVideoTile('local-participant', `${myName} (You)`, localStream, true);
      participantKnockHost(true);
    } else {
      // Participant enters pre-join lobby
      lobbySessionTitle.textContent = sessionTitle;
      lobbyModal.style.display = 'flex';
      lobbyPrejoinCard.style.display = 'block';
      await startLobbyPreview();
    }
  }
});

// -----------------------------------------------------------------------------
// Host Setup
// -----------------------------------------------------------------------------
async function startMediaAndHost() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true
    });
  } catch (err) {
    console.warn('Could not get full media (mic/cam), fallback to audio or empty:', err);
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e2) {
      localStream = createEmptyMediaStream(sessionTitle);
    }
  }

  // Add Host self tile
  createVideoTile('local-host', 'You (Host)', localStream, true);

  // Initialize Host Session Timing & Save to Host Device Database
  sessionStartTime = new Date();
  sessionStartTimestamp = sessionStartTime.getTime();
  if (window.sessionDB) {
    window.sessionDB.saveSession({
      roomCode: roomCode,
      title: sessionTitle,
      date: sessionStartTime.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
      startTime: sessionStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      startTimestamp: sessionStartTimestamp,
      endTime: 'In Progress...',
      durationText: 'Active now',
      hasRecording: false
    }).catch(e => console.warn('DB saveSession error:', e));
  }

  // Initialize Host Peer with auto-retry
  initHostPeer();
}

let hostPeerRetryTimeout = null;
let hostPeerRetryAttempts = 0;

function showReconnectingBanner(show, text) {
  const b = document.getElementById('reconnecting-banner');
  const t = document.getElementById('reconnecting-text');
  if (!b) return;
  if (show) {
    if (t && text) t.textContent = text;
    b.style.display = 'flex';
  } else {
    b.style.display = 'none';
  }
}

function initHostPeer() {
  if (hostPeerRetryTimeout) {
    clearTimeout(hostPeerRetryTimeout);
    hostPeerRetryTimeout = null;
  }
  if (peer && !peer.destroyed) {
    try { peer.destroy(); } catch (e) {}
  }

  myPeerId = hostPeerId;
  peer = new Peer(myPeerId, PEER_CONFIG);

  peer.on('open', (id) => {
    hostPeerRetryAttempts = 0;
    console.log('Host session active with Peer ID:', id);
    showReconnectingBanner(false);
    showToast('Session is live. Ready to admit participants!');
  });

  peer.on('error', (err) => {
    console.error('Host Peer error:', err);
    if (err.type === 'unavailable-id') {
      hostPeerRetryAttempts++;
      showReconnectingBanner(true, `Re-establishing host link (attempt ${hostPeerRetryAttempts})...`);
      // Retry every 1.5s until PeerJS Cloud frees the old socket
      hostPeerRetryTimeout = setTimeout(() => {
        initHostPeer();
      }, 1500);
    }
  });

  // Listen for incoming participant data connections (knock, chat, raise-hand)
  peer.on('connection', (conn) => {
    handleIncomingConnectionAsHost(conn);
  });

  // Listen for participant calls (if they initiate)
  peer.on('call', (call) => {
    const streamToSend = screenStream || localStream;
    call.answer(streamToSend);
    call.on('stream', (remoteStream) => {
      const pInfo = connectedPeers[call.peer];
      const pName = pInfo ? pInfo.name : 'Participant';
      createVideoTile(call.peer, pName, remoteStream, false);
    });
  });
}

function handleIncomingConnectionAsHost(conn) {
  conn.on('open', () => {
    conn.on('data', (data) => {
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'knock':
          if (data.autoRejoin) {
            // Re-admit immediately on participant refresh or reconnection
            const pName = data.name || 'Participant';
            // Remove any stale video tiles or records for this participant name
            for (const [oldPeerId, oldPData] of Object.entries(connectedPeers)) {
              if (oldPData.name === pName && oldPeerId !== conn.peer) {
                delete connectedPeers[oldPeerId];
                removeVideoTile(oldPeerId);
              }
            }
            waitingList[conn.peer] = { conn, name: pName };
            window.admitParticipant(conn.peer, true);
          } else {
            // Participant asks to join
            onParticipantKnock(conn, data.name || 'Participant');
          }
          break;

        case 'cancel-knock':
          removeParticipantFromWaiting(conn.peer);
          break;

        case 'chat':
          // Universal Chat: receive message and broadcast to all participants
          broadcastChatMessage({
            sender: data.sender || 'Participant',
            isHost: false,
            text: data.text,
            time: data.time
          });
          break;

        case 'raise-hand':
          onParticipantRaiseHand(conn.peer, data.name, data.raised);
          break;

        case 'leave':
          handleParticipantDisconnect(conn.peer);
          break;
      }
    });
  });

  conn.on('close', () => {
    removeParticipantFromWaiting(conn.peer);
    handleParticipantDisconnect(conn.peer);
  });

  conn.on('error', () => {
    removeParticipantFromWaiting(conn.peer);
    handleParticipantDisconnect(conn.peer);
  });
}

function onParticipantKnock(conn, name) {
  const peerId = conn.peer;
  waitingList[peerId] = { conn, name };
  updateWaitingRoomUI();

  // Play audible chime alert
  sounds.playKnock();

  // Show floating alert prompt
  activeKnockId = peerId;
  floatingKnockName.textContent = name;
  floatingKnockAlert.classList.add('show');
}

function removeParticipantFromWaiting(peerId) {
  delete waitingList[peerId];
  if (activeKnockId === peerId) {
    floatingKnockAlert.classList.remove('show');
    activeKnockId = null;
  }
  updateWaitingRoomUI();
}

function updateWaitingRoomUI() {
  const count = Object.keys(waitingList).length;
  if (badgeWaitingCount) {
    badgeWaitingCount.textContent = count;
    badgeWaitingCount.classList.toggle('active', count > 0);
  }
  if (waitingDrawerCount) {
    waitingDrawerCount.textContent = count;
  }

  // Render Waiting List inside Drawer
  if (knockList) {
    knockList.innerHTML = '';
    if (count === 0) {
      if (emptyWaitingMsg) {
        emptyWaitingMsg.style.display = 'block';
        knockList.appendChild(emptyWaitingMsg);
      }
      return;
    }
    if (emptyWaitingMsg) emptyWaitingMsg.style.display = 'none';

    for (const [pId, info] of Object.entries(waitingList)) {
      const item = document.createElement('div');
      item.className = 'knock-item';
      item.innerHTML = `
        <span class="knock-name">${escapeHtml(info.name)}</span>
        <div class="knock-actions">
          <button class="btn-admit" onclick="admitParticipant('${pId}')">Admit</button>
          <button class="btn-deny" onclick="denyParticipant('${pId}')">Deny</button>
        </div>
      `;
      knockList.appendChild(item);
    }
  }
}

// Admit / Deny methods accessible from window
window.admitParticipant = async function(peerId, isAutoRejoin = false) {
  const info = waitingList[peerId];
  if (!info) return;

  // 1. Notify participant they are admitted
  try {
    info.conn.send({
      type: 'admitted',
      sessionTitle: sessionTitle,
      autoRejoin: isAutoRejoin
    });
  } catch (e) {
    console.warn('Send admitted notice error:', e);
  }

  // 2. Ensure stream is available before calling
  let streamToSend = screenStream || localStream;
  if (!streamToSend || streamToSend.getTracks().length === 0) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      streamToSend = localStream;
    } catch (e) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamToSend = localStream;
      } catch (e2) {
        localStream = createEmptyMediaStream(sessionTitle);
        streamToSend = localStream;
      }
    }
  }

  // 3. Call participant with audio/video stream
  const call = peer.call(peerId, streamToSend);
  connectedPeers[peerId] = {
    conn: info.conn,
    call: call,
    name: info.name,
    handRaised: false
  };

  call.on('stream', (remoteStream) => {
    if (connectedPeers[peerId]) {
      connectedPeers[peerId].remoteStream = remoteStream;
    }
    createVideoTile(peerId, info.name, remoteStream, false);
  });

  call.on('close', () => {
    handleParticipantDisconnect(peerId);
  });

  removeParticipantFromWaiting(peerId);
  if (!isAutoRejoin) {
    showToast(`Admitted ${info.name}`);
    broadcastChatMessage({
      sender: 'System',
      isHost: false,
      text: `${info.name} joined the session`,
      time: getCurrentTime()
    });
  }
};

window.denyParticipant = function(peerId) {
  const info = waitingList[peerId];
  if (!info) return;

  info.conn.send({ type: 'denied' });
  removeParticipantFromWaiting(peerId);
  showToast(`Declined ${info.name}`);
};

btnFloatingAdmit.addEventListener('click', () => {
  if (activeKnockId) {
    window.admitParticipant(activeKnockId);
    floatingKnockAlert.classList.remove('show');
  }
});

btnFloatingDeny.addEventListener('click', () => {
  if (activeKnockId) {
    window.denyParticipant(activeKnockId);
    floatingKnockAlert.classList.remove('show');
  }
});

function handleParticipantDisconnect(peerId) {
  if (connectedPeers[peerId]) {
    const name = connectedPeers[peerId].name;
    delete connectedPeers[peerId];
    removeVideoTile(peerId);
    updateHandsUI();

    broadcastChatMessage({
      sender: 'System',
      isHost: false,
      text: `${name} left the session`,
      time: getCurrentTime()
    });
  }
}

// -----------------------------------------------------------------------------
// Participant Flow
// -----------------------------------------------------------------------------
async function startLobbyPreview() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    lobbyVideoPreview.srcObject = localStream;
  } catch (err) {
    console.warn('Lobby preview error:', err);
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e2) {
      localStream = createEmptyMediaStream(sessionTitle);
    }
  }
}

btnLobbyMic.addEventListener('click', () => {
  if (!localStream) return;
  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length > 0) {
    audioTracks[0].enabled = !audioTracks[0].enabled;
    const isMuted = !audioTracks[0].enabled;
    lobbyMicIcon.textContent = isMuted ? '🔇' : '🎤';
    btnLobbyMic.classList.toggle('off', isMuted);
  }
});

btnLobbyCam.addEventListener('click', () => {
  if (!localStream) return;
  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length > 0) {
    videoTracks[0].enabled = !videoTracks[0].enabled;
    const isOff = !videoTracks[0].enabled;
    lobbyCamIcon.textContent = isOff ? '🚫' : '📹';
    btnLobbyCam.classList.toggle('off', isOff);
    lobbyVideoPreview.style.display = isOff ? 'none' : 'block';
    lobbyAvatar.classList.toggle('visible', isOff);
  }
});

btnRequestJoin.addEventListener('click', () => {
  const name = participantNameInput.value.trim();
  if (!name) {
    alert('Please enter your name to join.');
    participantNameInput.focus();
    return;
  }
  myName = name;
  participantKnockHost();
});

let participantHostConn = null;

function participantKnockHost(isAuto = false) {
  if (isAuto) {
    showReconnectingBanner(true, 'Connecting to host...');
  } else {
    lobbyPrejoinCard.style.display = 'none';
    lobbyWaitingCard.style.display = 'block';
  }

  if (peer && !peer.destroyed) {
    try { peer.destroy(); } catch (e) {}
  }

  // Random participant peer ID
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  myPeerId = `session-${roomCode}-p-${randomSuffix}`;
  peer = new Peer(myPeerId, PEER_CONFIG);

  peer.on('open', () => {
    connectToHost(isAuto);
  });

  peer.on('call', (call) => {
    // Answer host call with participant's stream
    call.answer(localStream);
    call.on('stream', (hostStream) => {
      createVideoTile(hostPeerId, 'Host (Presenter)', hostStream, false);
    });
  });

  peer.on('error', (err) => {
    console.warn('Participant Peer error:', err);
    if (err.type === 'peer-unavailable') {
      if (isAuto) {
        // Host might be refreshing, auto-retry silently
        showReconnectingBanner(true, 'Host refreshing, re-linking...');
        setTimeout(() => {
          const isLeft = lobbyLeftCard && lobbyLeftCard.style.display === 'block';
          if (!isLeft) {
            participantKnockHost(true);
          }
        }, 2000);
      } else {
        showToast('Host has not started the session yet. Please wait...');
      }
    }
  });
}

function connectToHost(isAuto = false) {
  if (participantHostConn) {
    try { participantHostConn.close(); } catch (e) {}
  }

  participantHostConn = peer.connect(hostPeerId, { reliable: true });

  participantHostConn.on('open', () => {
    if (isAuto) {
      showReconnectingBanner(true, 'Re-linking with host...');
    }
    participantHostConn.send({
      type: 'knock',
      name: myName,
      autoRejoin: isAuto
    });
  });

  participantHostConn.on('data', (data) => {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'admitted') {
      showReconnectingBanner(false);
      onParticipantAdmitted(data.autoRejoin);
    } else if (data.type === 'denied') {
      showReconnectingBanner(false);
      lobbyWaitingCard.style.display = 'none';
      lobbyDeniedCard.style.display = 'block';
    } else if (data.type === 'chat') {
      addChatMessage(data);
    } else if (data.type === 'raise-hand-sync') {
      updateRemoteHandBadge(data.peerId, data.raised);
    }
  });

  participantHostConn.on('close', () => {
    // If host refreshed, do NOT kick student to lobby! Silently auto-reconnect!
    const isLeft = lobbyLeftCard && lobbyLeftCard.style.display === 'block';
    if (!isLeft) {
      showReconnectingBanner(true, 'Host refreshed. Re-linking automatically...');
      setTimeout(() => {
        participantKnockHost(true);
      }, 2000);
    }
  });

  participantHostConn.on('error', (err) => {
    console.warn('Host connection error:', err);
  });
}

function onParticipantAdmitted(isAuto = false) {
  lobbyModal.style.display = 'none';
  sessionStorage.setItem('admitted_name_' + roomCode, myName);
  sessionStorage.setItem('admitted_room', roomCode);

  if (!isAuto) {
    showToast('You are connected to the session!');
  } else {
    showToast('Reconnected to host!');
  }

  // Mount self tile in participant's room view
  createVideoTile('local-participant', `${myName} (You)`, localStream, true);

  // Sync mic and cam controls
  syncMediaControls();
}

btnCancelKnock.addEventListener('click', () => {
  if (participantHostConn && participantHostConn.open) {
    participantHostConn.send({ type: 'cancel-knock' });
  }
  if (peer) peer.destroy();
  lobbyWaitingCard.style.display = 'none';
  lobbyPrejoinCard.style.display = 'block';
});

btnRetryKnock.addEventListener('click', () => {
  lobbyDeniedCard.style.display = 'none';
  lobbyPrejoinCard.style.display = 'block';
});

// -----------------------------------------------------------------------------
// Video Grid & Tiles Management
// -----------------------------------------------------------------------------
function createVideoTile(id, label, stream, isSelf = false) {
  // If tile already exists, update stream
  let tile = document.getElementById(`tile-${id}`);
  if (tile) {
    const video = tile.querySelector('video');
    if (video) video.srcObject = stream;
    return;
  }

  tile = document.createElement('div');
  tile.id = `tile-${id}`;
  tile.className = 'video-tile';

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  if (isSelf) video.muted = true; // Avoid feedback
  video.srcObject = stream;

  const overlay = document.createElement('div');
  overlay.className = 'tile-overlay';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'tile-name';
  nameSpan.innerHTML = `<span>${escapeHtml(label)}</span>`;

  const handBadge = document.createElement('span');
  handBadge.className = 'tile-badge-hand';
  handBadge.id = `hand-badge-${id}`;
  handBadge.textContent = '✋ Hand Raised';

  overlay.appendChild(nameSpan);
  overlay.appendChild(handBadge);

  // Avatar placeholder when video is off
  const avatar = document.createElement('div');
  avatar.className = 'tile-avatar';
  avatar.textContent = label.charAt(0);

  tile.appendChild(video);
  tile.appendChild(avatar);
  tile.appendChild(overlay);

  videoGrid.appendChild(tile);
  adjustGrid();
}

function removeVideoTile(id) {
  const tile = document.getElementById(`tile-${id}`);
  if (tile) {
    tile.remove();
    adjustGrid();
  }
}

function adjustGrid() {
  const tiles = videoGrid.querySelectorAll('.video-tile');
  if (tiles.length <= 1) {
    videoGrid.classList.add('single-video');
  } else {
    videoGrid.classList.remove('single-video');
  }
}

// -----------------------------------------------------------------------------
// Bottom Controls Logic
// -----------------------------------------------------------------------------
function syncMediaControls() {
  if (localStream) {
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      isMicMuted = !audioTracks[0].enabled;
      btnToggleMic.classList.toggle('off', isMicMuted);
      iconMic.textContent = isMicMuted ? '🔇' : '🎤';
    }

    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      isCamOff = !videoTracks[0].enabled;
      btnToggleCam.classList.toggle('off', isCamOff);
      iconCam.textContent = isCamOff ? '🚫' : '📹';
    }
  }
}

// Mic Toggle
btnToggleMic.addEventListener('click', () => {
  if (!localStream) return;
  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length > 0) {
    isMicMuted = !isMicMuted;
    audioTracks[0].enabled = !isMicMuted;
    btnToggleMic.classList.toggle('off', isMicMuted);
    iconMic.textContent = isMicMuted ? '🔇' : '🎤';
    showToast(isMicMuted ? 'Microphone Muted' : 'Microphone Unmuted');
  }
});

// Cam Toggle
btnToggleCam.addEventListener('click', () => {
  if (!localStream) return;
  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length > 0) {
    isCamOff = !isCamOff;
    videoTracks[0].enabled = !isCamOff;
    btnToggleCam.classList.toggle('off', isCamOff);
    iconCam.textContent = isCamOff ? '🚫' : '📹';

    const selfTileId = isHost ? 'tile-local-host' : 'tile-local-participant';
    const selfTile = document.getElementById(selfTileId);
    if (selfTile) {
      const v = selfTile.querySelector('video');
      const av = selfTile.querySelector('.tile-avatar');
      if (v) v.style.display = isCamOff ? 'none' : 'block';
      if (av) av.classList.toggle('visible', isCamOff);
    }
    showToast(isCamOff ? 'Camera Turned Off' : 'Camera Turned On');
  }
});

// -----------------------------------------------------------------------------
// Host Screen Sharing
// -----------------------------------------------------------------------------
if (isHost && btnScreenShare) {
  btnScreenShare.addEventListener('click', async () => {
    if (!isScreenSharing) {
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        isScreenSharing = true;
        btnScreenShare.classList.add('active');
        showToast('Screen sharing started');

        // Replace video track in calls
        const screenTrack = screenStream.getVideoTracks()[0];
        replaceVideoTrackInCalls(screenTrack);

        // Update Host's local tile to show screen
        const hostTile = document.getElementById('tile-local-host');
        if (hostTile) {
          hostTile.classList.add('presenting');
          const video = hostTile.querySelector('video');
          if (video) video.srcObject = screenStream;
        }

        // Handle user stopping share via browser native banner
        screenTrack.onended = () => {
          stopScreenSharing();
        };
      } catch (err) {
        console.warn('Screen share canceled or error:', err);
      }
    } else {
      stopScreenSharing();
    }
  });

  function stopScreenSharing() {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      screenStream = null;
    }
    isScreenSharing = false;
    btnScreenShare.classList.remove('active');

    // Switch back to webcam
    if (localStream) {
      const camTrack = localStream.getVideoTracks()[0];
      replaceVideoTrackInCalls(camTrack);
      const hostTile = document.getElementById('tile-local-host');
      if (hostTile) {
        hostTile.classList.remove('presenting');
        const video = hostTile.querySelector('video');
        if (video) video.srcObject = localStream;
      }
    }
    showToast('Screen sharing stopped');
  }

  function replaceVideoTrackInCalls(newTrack) {
    for (const info of Object.values(connectedPeers)) {
      if (info.call && info.call.peerConnection) {
        const senders = info.call.peerConnection.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender && newTrack) {
          videoSender.replaceTrack(newTrack);
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Host Video Recording with Dual Mode (Whole Screen vs Host Only)
// -----------------------------------------------------------------------------
let currentRecordMode = 'Host Only';
let wholeScreenCaptureStream = null;
const recordOptionsModal = document.getElementById('record-options-modal');
const btnRecWholeScreen = document.getElementById('btn-rec-whole-screen');
const btnRecHostOnly = document.getElementById('btn-rec-host-only');
const btnRecCancel = document.getElementById('btn-rec-cancel');

// Continuous Netlify Badge Purge (Guarantees badge never covers mobile buttons)
setInterval(() => {
  document.querySelectorAll('#netlify-badge, .netlify-badge, [data-netlify-deploy-id], [data-netlify-badge]').forEach(el => {
    el.remove();
  });
}, 500);

if (isHost) {
  btnRecordSession.addEventListener('click', () => {
    if (!isRecording) {
      if (recordOptionsModal) {
        recordOptionsModal.style.display = 'flex';
      } else {
        startRecording('Host Only');
      }
    } else {
      stopRecording();
    }
  });

  if (btnRecWholeScreen) {
    btnRecWholeScreen.addEventListener('click', async () => {
      recordOptionsModal.style.display = 'none';
      try {
        wholeScreenCaptureStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser' },
          audio: true
        });
        startRecording('Whole Screen');
      } catch (err) {
        console.warn('Whole screen capture cancelled or failed:', err);
        showToast('Screen capture cancelled.');
      }
    });
  }

  if (btnRecHostOnly) {
    btnRecHostOnly.addEventListener('click', () => {
      recordOptionsModal.style.display = 'none';
      startRecording('Host Only');
    });
  }

  if (btnRecCancel) {
    btnRecCancel.addEventListener('click', () => {
      recordOptionsModal.style.display = 'none';
    });
  }

  function getBestSupportedMimeType() {
    const types = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1,opus',
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm'
    ];
    for (const t of types) {
      if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }

  function startRecording(mode = 'Host Only') {
    currentRecordMode = mode;
    const combinedTracks = [];

    // Master Web Audio Mixer:
    // Blends Host Microphone + ALL Participant/Student Voices + Screen Audio into one unified stereo track
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const mixerCtx = new AudioCtx();
      const mixerDest = mixerCtx.createMediaStreamDestination();
      let hasActiveAudioSources = false;

      // 1. Mix Host microphone (if host has mic)
      if (localStream && localStream.getAudioTracks().length > 0) {
        try {
          const hostAudioSrc = mixerCtx.createMediaStreamSource(new MediaStream(localStream.getAudioTracks()));
          hostAudioSrc.connect(mixerDest);
          hasActiveAudioSources = true;
        } catch (e) {}
      }

      // 2. Mix ALL participants' voices (every student who speaks!)
      for (const info of Object.values(connectedPeers)) {
        if (info.remoteStream && info.remoteStream.getAudioTracks().length > 0) {
          try {
            const peerAudioSrc = mixerCtx.createMediaStreamSource(new MediaStream(info.remoteStream.getAudioTracks()));
            peerAudioSrc.connect(mixerDest);
            hasActiveAudioSources = true;
          } catch (e) {}
        }
      }

      // 3. Mix Whole Screen / Tab audio if captured
      if (mode === 'Whole Screen' && wholeScreenCaptureStream && wholeScreenCaptureStream.getAudioTracks().length > 0) {
        try {
          const screenAudioSrc = mixerCtx.createMediaStreamSource(new MediaStream(wholeScreenCaptureStream.getAudioTracks()));
          screenAudioSrc.connect(mixerDest);
          hasActiveAudioSources = true;
        } catch (e) {}
      }

      // 4. If host PC has no mic and no one is speaking, keep carrier active so recorder writes valid file
      const osc = mixerCtx.createOscillator();
      const gain = mixerCtx.createGain();
      gain.gain.value = 0.0001; // subtle carrier
      osc.connect(gain);
      gain.connect(mixerDest);
      osc.start();

      const mixedAudioTrack = mixerDest.stream.getAudioTracks()[0];
      if (mixedAudioTrack) {
        combinedTracks.push(mixedAudioTrack);
      }
    } catch (mixerErr) {
      console.warn('Audio mixer fallback:', mixerErr);
      if (localStream) {
        localStream.getAudioTracks().forEach(t => combinedTracks.push(t));
      }
    }

    // 5. Select visual source based on chosen mode:
    // Whole Screen: records entire meeting tab with all student video tiles, names & chat!
    // Host Only: records presenter stream or screen share
    let visualSource = null;
    if (mode === 'Whole Screen' && wholeScreenCaptureStream) {
      visualSource = wholeScreenCaptureStream;
    } else {
      visualSource = screenStream || localStream;
    }

    if (visualSource) {
      visualSource.getVideoTracks().forEach(t => combinedTracks.push(t));
    }

    if (combinedTracks.length === 0) {
      showToast('No active video or audio source available to record.');
      return;
    }

    const recordStream = new MediaStream(combinedTracks);

    try {
      recordedChunks = [];
      const mime = getBestSupportedMimeType();
      const options = mime ? { mimeType: mime } : {};

      mediaRecorder = new MediaRecorder(recordStream, options);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        saveRecordingFile();
      };

      // Emit data every 500ms
      mediaRecorder.start(500);
      isRecording = true;
      btnRecordSession.classList.add('record-active');
      recIndicator.classList.add('active');

      recSeconds = 0;
      recTimerInterval = setInterval(() => {
        recSeconds++;
        const mins = String(Math.floor(recSeconds / 60)).padStart(2, '0');
        const secs = String(recSeconds % 60).padStart(2, '0');
        recTimer.textContent = `${mins}:${secs}`;
      }, 1000);

      showToast(`Recording started (${mode})`);
    } catch (err) {
      console.error('Recording start failed:', err);
      showToast('Could not start recording: ' + err.message);
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.requestData();
      } catch (e) {
        console.warn('requestData error:', e);
      }
      mediaRecorder.stop();
    }

    if (wholeScreenCaptureStream) {
      wholeScreenCaptureStream.getTracks().forEach(t => t.stop());
      wholeScreenCaptureStream = null;
    }

    isRecording = false;
    btnRecordSession.classList.remove('record-active');
    recIndicator.classList.remove('active');
    clearInterval(recTimerInterval);
    recTimer.textContent = '00:00';
    showToast('Finalizing and saving recording...');
  }

  async function saveRecordingFile() {
    if (!recordedChunks || recordedChunks.length === 0) {
      showToast('Recording was too short to save.');
      return;
    }

    // Strictly save as MP4 video format
    const blob = new Blob(recordedChunks, { type: 'video/mp4' });

    if (blob.size === 0) {
      showToast('Recording produced 0 bytes.');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeModeName = currentRecordMode.replace(/\s+/g, '-');
    const filename = `Session-${roomCode}-${safeModeName}-${timestamp}.mp4`;

    // 1. Save directly into Host IndexedDB (Preserves ALL recording parts in MP4 format)
    if (window.sessionDB) {
      try {
        await window.sessionDB.saveRecording(roomCode, blob, filename, currentRecordMode + ' (MP4)');
      } catch (err) {
        console.warn('Failed to save recording to database:', err);
      }
    }

    // 2. Trigger instant browser download strictly as .mp4
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 500);

    const sizeStr = window.sessionDB ? window.sessionDB.formatBytes(blob.size) : `${Math.round(blob.size / 1024)} KB`;
    showToast(`Saved Part (${currentRecordMode} - MP4): ${sizeStr}`);
  }
}

// -----------------------------------------------------------------------------
// Raised Hands Feature
// -----------------------------------------------------------------------------
if (!isHost) {
  // Participant Toggles Hand
  if (btnRaiseHand) {
    btnRaiseHand.addEventListener('click', () => {
      isHandRaised = !isHandRaised;
      btnRaiseHand.classList.toggle('hand-active', isHandRaised);
      
      // Update local tile
      const handBadge = document.getElementById('hand-badge-local-participant');
      if (handBadge) handBadge.classList.toggle('active', isHandRaised);

      const selfTile = document.getElementById('tile-local-participant');
      if (selfTile) selfTile.classList.toggle('hand-raised', isHandRaised);

      // Notify Host via Data Channel
      if (participantHostConn && participantHostConn.open) {
        participantHostConn.send({
          type: 'raise-hand',
          raised: isHandRaised,
          name: myName
        });
      }

      showToast(isHandRaised ? 'Hand raised. Host notified.' : 'Hand lowered.');
    });
  }
} else {
  // Host Views Raised Hands
  if (btnViewHands) {
    btnViewHands.addEventListener('click', () => {
      if (handsDrawer) handsDrawer.classList.toggle('open');
      if (chatDrawer) chatDrawer.classList.remove('open');
      if (waitingDrawer) waitingDrawer.classList.remove('open');
    });
  }

  if (btnCloseHands) {
    btnCloseHands.addEventListener('click', () => {
      if (handsDrawer) handsDrawer.classList.remove('open');
    });
  }

  function onParticipantRaiseHand(peerId, name, raised) {
    if (connectedPeers[peerId]) {
      connectedPeers[peerId].handRaised = raised;
    }

    if (raised) {
      sounds.playRaiseHand();
      showToast(`${name} raised their hand! ✋`);
    }

    // Update tile badge
    updateRemoteHandBadge(peerId, raised);
    updateHandsUI();

    // Broadcast update to all participants so everyone sees who has hand raised
    for (const info of Object.values(connectedPeers)) {
      if (info.conn && info.conn.open) {
        info.conn.send({
          type: 'raise-hand-sync',
          peerId: peerId,
          raised: raised
        });
      }
    }
  }

  function updateHandsUI() {
    const raisedPeers = Object.entries(connectedPeers).filter(([_, info]) => info.handRaised);
    const count = raisedPeers.length;

    if (badgeHandsCount) {
      badgeHandsCount.textContent = count;
      badgeHandsCount.classList.toggle('active', count > 0);
    }
    if (handsDrawerCount) {
      handsDrawerCount.textContent = count;
    }

    if (handsList) {
      handsList.innerHTML = '';
      if (count === 0) {
        if (emptyHandsMsg) {
          emptyHandsMsg.style.display = 'block';
          handsList.appendChild(emptyHandsMsg);
        }
        return;
      }
      if (emptyHandsMsg) emptyHandsMsg.style.display = 'none';

      for (const [pId, info] of raisedPeers) {
        const item = document.createElement('div');
        item.className = 'knock-item';
        item.innerHTML = `
          <span class="knock-name">✋ ${escapeHtml(info.name)}</span>
          <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="lowerRemoteHand('${pId}')">Lower Hand</button>
        `;
        handsList.appendChild(item);
      }
    }
  }

  window.lowerRemoteHand = function(peerId) {
    if (connectedPeers[peerId]) {
      connectedPeers[peerId].handRaised = false;
      updateRemoteHandBadge(peerId, false);
      updateHandsUI();
    }
  };
}

function updateRemoteHandBadge(peerId, raised) {
  const badge = document.getElementById(`hand-badge-${peerId}`);
  if (badge) badge.classList.toggle('active', raised);

  const tile = document.getElementById(`tile-${peerId}`);
  if (tile) tile.classList.toggle('hand-raised', raised);
}

// -----------------------------------------------------------------------------
// Universal Chat System (All in one box, everyone sees all messages)
// -----------------------------------------------------------------------------
if (btnToggleChat) {
  btnToggleChat.addEventListener('click', () => {
    if (chatDrawer) {
      chatDrawer.classList.toggle('open');
      if (waitingDrawer) waitingDrawer.classList.remove('open');
      if (handsDrawer) handsDrawer.classList.remove('open');
      if (chatDrawer.classList.contains('open')) {
        unreadChatCount = 0;
        if (badgeChatUnread) {
          badgeChatUnread.textContent = '0';
          badgeChatUnread.classList.remove('active');
        }
        if (chatInput) setTimeout(() => chatInput.focus(), 150);
      }
    }
  });
}

if (btnCloseChat) {
  btnCloseChat.addEventListener('click', () => {
    if (chatDrawer) chatDrawer.classList.remove('open');
  });
}

// Waiting Room Drawer button for Host
if (isHost && btnWaitingRoom) {
  btnWaitingRoom.addEventListener('click', () => {
    if (waitingDrawer) {
      waitingDrawer.classList.toggle('open');
      if (chatDrawer) chatDrawer.classList.remove('open');
      if (handsDrawer) handsDrawer.classList.remove('open');
    }
  });
}

if (btnCloseWaiting) {
  btnCloseWaiting.addEventListener('click', () => {
    if (waitingDrawer) waitingDrawer.classList.remove('open');
  });
}

if (chatForm) {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    const msgObj = {
    sender: myName,
    isHost: isHost,
    text: text,
    time: getCurrentTime()
  };

  if (isHost) {
    // Broadcast to all connected participants
    broadcastChatMessage(msgObj);
  } else {
    // Participant sends to Host
    if (participantHostConn && participantHostConn.open) {
      participantHostConn.send({
        type: 'chat',
        ...msgObj
      });
      addChatMessage(msgObj, true);
    }
  }

    chatInput.value = '';
  });
}

function broadcastChatMessage(msgObj) {
  // Add to host's own chat
  addChatMessage(msgObj, msgObj.isHost);

  // Send to every connected participant
  for (const info of Object.values(connectedPeers)) {
    if (info.conn && info.conn.open) {
      info.conn.send({
        type: 'chat',
        ...msgObj
      });
    }
  }
}

function addChatMessage(msg, isMine = false) {
  sounds.playChatPop();

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isMine ? 'mine' : ''}`;

  const hostBadgeHtml = msg.isHost ? '<span class="host-tag">Host</span>' : '';

  bubble.innerHTML = `
    <div class="chat-sender">
      ${escapeHtml(msg.sender)} ${hostBadgeHtml}
      <span class="chat-time">${msg.time}</span>
    </div>
    <div class="chat-text">${escapeHtml(msg.text)}</div>
  `;

  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Unread badge indicator if chat drawer is closed
  if (!chatDrawer.classList.contains('open')) {
    unreadChatCount++;
    badgeChatUnread.textContent = unreadChatCount;
    badgeChatUnread.classList.add('active');
  }
}

// -----------------------------------------------------------------------------
// Leave / End Call & Finalize Session Timing
// -----------------------------------------------------------------------------
async function finalizeHostSession() {
  if (!isHost || !window.sessionDB) return;
  const endTimestamp = Date.now();
  const durationSecs = Math.max(1, Math.round((endTimestamp - sessionStartTimestamp) / 1000));
  const hrs = Math.floor(durationSecs / 3600);
  const mins = Math.floor((durationSecs % 3600) / 60);
  const secs = durationSecs % 60;
  let durationText = '';
  if (hrs > 0) {
    durationText = `${hrs} hr ${mins} min`;
  } else if (mins > 0) {
    durationText = `${mins} min ${secs} sec`;
  } else {
    durationText = `${secs} sec`;
  }

  const endTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  try {
    await window.sessionDB.saveSession({
      roomCode: roomCode,
      endTime: endTimeStr,
      endTimestamp: endTimestamp,
      durationSeconds: durationSecs,
      durationText: durationText
    });
  } catch (err) {
    console.warn('Error saving final session data:', err);
  }
}

// Auto update on window unload
window.addEventListener('beforeunload', () => {
  if (isHost) {
    finalizeHostSession();
  }
});

btnLeaveCall.addEventListener('click', async () => {
  const confirmMsg = isHost 
    ? 'Are you sure you want to end this session for everyone?' 
    : 'Are you sure you want to leave this session?';

  if (confirm(confirmMsg)) {
    if (isHost) {
      // Host leaves: finalize timings and return to Host dashboard
      await finalizeHostSession();
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
      }
      if (peer) {
        peer.destroy();
      }
      window.location.href = 'index.html';
    } else {
      // Participant leaves: DO NOT redirect to host dashboard!
      // Keep on participant screen with their name saved and a 1-click Rejoin button
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      if (participantHostConn && participantHostConn.open) {
        participantHostConn.send({ type: 'leave' });
      }
      if (peer) {
        peer.destroy();
      }
      showParticipantLeftScreen();
    }
  }
});

function showParticipantLeftScreen() {
  const lobbyModal = document.getElementById('lobby-modal');
  const lobbyLeftCard = document.getElementById('lobby-left-card');
  const leftParticipantMsg = document.getElementById('left-participant-msg');
  const btnRejoinParticipant = document.getElementById('btn-rejoin-participant');

  // Hide other lobby cards
  document.getElementById('lobby-prejoin-card').style.display = 'none';
  document.getElementById('lobby-waiting-card').style.display = 'none';
  document.getElementById('lobby-denied-card').style.display = 'none';

  if (leftParticipantMsg) {
    leftParticipantMsg.textContent = `${myName}, you have left the session. You can rejoin at any time.`;
  }

  lobbyModal.style.display = 'flex';
  lobbyLeftCard.style.display = 'block';

  btnRejoinParticipant.onclick = async () => {
    lobbyLeftCard.style.display = 'none';
    lobbyModal.style.display = 'none';
    showToast('Rejoining session...');
    showReconnectingBanner(true, 'Rejoining session...');
    await startLobbyPreview();
    createVideoTile('local-participant', `${myName} (You)`, localStream, true);
    participantKnockHost(true);
  };
}

// -----------------------------------------------------------------------------
// Helper Utilities
// -----------------------------------------------------------------------------
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function createEmptyMediaStream(label = 'Live Presenter') {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  let frameCount = 0;
  function drawFrame() {
    frameCount++;
    // Sleek dark studio background with subtle gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center Presenter badge
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 40, 70, 0, Math.PI * 2);
    ctx.fill();

    // Studio Icon
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎙️', canvas.width / 2, canvas.height / 2 - 40);

    // Presenter & Session Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label || 'Live Presenter', canvas.width / 2, canvas.height / 2 + 70);

    // Room tag
    ctx.fillStyle = '#818cf8';
    ctx.font = '22px sans-serif';
    ctx.fillText(`Room: ${roomCode} • Live Studio`, canvas.width / 2, canvas.height / 2 + 115);

    // Live Clock & Active Pulse
    const nowStr = new Date().toLocaleTimeString();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px monospace';
    ctx.fillText(`● LIVE ${nowStr}`, canvas.width / 2, canvas.height / 2 + 155);

    // Pulsing audio wave animation at bottom (guarantees continuous motion frames)
    ctx.fillStyle = 'rgba(129, 140, 248, 0.4)';
    for (let i = 0; i < 30; i++) {
      const h = Math.abs(Math.sin((frameCount + i * 8) * 0.05)) * 40 + 6;
      ctx.fillRect(canvas.width / 2 - 150 + i * 10, canvas.height - 80 - h / 2, 6, h);
    }

    requestAnimationFrame(drawFrame);
  }
  drawFrame();

  // 30 FPS active video stream
  const videoStream = canvas.captureStream(30);

  // Generate real audio track so MediaRecorder produces valid playable audio+video
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const actx = new AudioCtx();
      const dest = actx.createMediaStreamDestination();
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      gain.gain.value = 0.0001; // active non-zero PCM stream
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        videoStream.addTrack(audioTrack);
      }
    }
  } catch (e) {
    console.warn('Audio synthesis fallback error:', e);
  }

  return videoStream;
}
