import { MatchmakingService } from '../../dist/gamepeer-sdk.esm.js';

  // DOM Elements
  const playerIdInput = document.getElementById('playerId');
  const roomNameInput = document.getElementById('roomName');
  const maxPlayersInput = document.getElementById('maxPlayers');
  const gameModeSelect = document.getElementById('gameMode');
  const roomPasswordInput = document.getElementById('roomPassword');
  const createBtn = document.getElementById('createBtn');
  const joinPlayerIdInput = document.getElementById('joinPlayerId');
  const roomList = document.getElementById('roomList');
  const passwordPrompt = document.getElementById('passwordPrompt');
  const joinPasswordInput = document.getElementById('joinPassword');
  const joinBtn = document.getElementById('joinBtn');
  const statusText = document.getElementById('statusText');

  // Matchmaking service instance
  const matchmakingService = new MatchmakingService({
    heartbeatInterval: 10000 // 10 seconds
  });

  let selectedRoom = null;

  // Initialize the demo
  function init() {
    // Set up event listeners
    createBtn.addEventListener('click', handleCreateRoom);
    joinBtn.addEventListener('click', handleJoinRoom);
    
    // Listen for room updates
    matchmakingService.on('roomsUpdated', updateRoomList);
    matchmakingService.on('error', handleError);
  }

  // Handle room creation
  async function handleCreateRoom() {
    const playerId = playerIdInput.value.trim();
    const roomName = roomNameInput.value.trim();
    const maxPlayers = parseInt(maxPlayersInput.value);
    const gameMode = gameModeSelect.value;
    const password = roomPasswordInput.value.trim();
    
    if (!playerId || !roomName) {
      updateStatus('Please enter both player ID and room name');
      return;
    }
    
    try {
      updateStatus('Initializing matchmaking service...');
      await matchmakingService.init(playerId);
      
      updateStatus('Creating room...');
      const success = await matchmakingService.registerRoom(
        `room-${Date.now()}`, // Simple room ID
        {
          gameName: roomName,
          maxPlayers,
          gameMode,
          password: password || undefined
        }
      );
      
      if (success) {
        updateStatus(`Room "${roomName}" created successfully!`);
      } else {
        updateStatus('Failed to create room');
      }
    } catch (err) {
      handleError(err);
    }
  }

  // Handle room joining
  async function handleJoinRoom() {
    const playerId = joinPlayerIdInput.value.trim();
    const password = joinPasswordInput.value.trim();
    
    if (!playerId) {
      updateStatus('Please enter your player ID');
      return;
    }
    
    if (!selectedRoom) {
      updateStatus('Please select a room first');
      return;
    }
    
    try {
      updateStatus('Initializing matchmaking service...');
      await matchmakingService.init(playerId);
      
      updateStatus(`Joining room "${selectedRoom.gameName}"...`);
      const roomInfo = await matchmakingService.joinRoom(
        selectedRoom.id,
        selectedRoom.hasPassword ? password : null
      );
      
      updateStatus(`Joined room "${selectedRoom.gameName}"! Host: ${roomInfo.host}`);
      // Here you would typically connect to the host using PeerConnectionManager
      console.log('Room info for connection:', roomInfo);
    } catch (err) {
      handleError(err);
    }
  }

  // Update the room list UI
  function updateRoomList({ rooms }) {
    roomList.innerHTML = '';
    
    if (rooms.length === 0) {
      roomList.innerHTML = '<li>No rooms available</li>';
      return;
    }
    
    rooms.forEach(room => {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${room.gameName}</strong><br>
        Players: ${room.players}/${room.maxPlayers} | 
        Mode: ${room.gameMode} | 
        ${room.hasPassword ? '🔒' : '🔓'}
      `;
      
      li.addEventListener('click', () => {
        // Remove selection from all items
        document.querySelectorAll('#roomList li').forEach(item => {
          item.style.backgroundColor = '';
        });
        
        // Select this item
        li.style.backgroundColor = '#e0e0e0';
        selectedRoom = room;
        
        // Show password prompt if needed
        passwordPrompt.style.display = room.hasPassword ? 'block' : 'none';
      });
      
      roomList.appendChild(li);
    });
  }

  // Handle errors
  function handleError(error) {
    console.error('Matchmaking error:', error);
    updateStatus(`Error: ${error.message || error}`);
  }

  // Update status text
  function updateStatus(text) {
    statusText.textContent = text;
    console.log(text);
  }

  // Initialize the demo when DOM is loaded
  document.addEventListener('DOMContentLoaded', init);
