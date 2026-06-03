// 1. Initialize WebSocket Connection
const socket = io();

const ticketIdInput = document.getElementById('ticket-id');
const loadBtn = document.getElementById('btn-load');
const seatGrid = document.getElementById('seat-grid');
const selectedSeatInput = document.getElementById('selected-seat');
const userIdInput = document.getElementById('user-id');
const reserveBtn = document.getElementById('btn-reserve');
const logConsole = document.getElementById('log-console');
const clearLogsBtn = document.getElementById('btn-clear-logs');

let currentSelectedSeat = null;

// Helper: Append logs to simulated terminal console
function addLog(message, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  
  let colorClass = 'text-gray-400';
  if (type === 'success') colorClass = 'text-green-400';
  if (type === 'warning') colorClass = 'text-amber-400';
  if (type === 'error') colorClass = 'text-red-400';
  if (type === 'socket') colorClass = 'text-teal-400';

  div.className = `${colorClass} mb-1`;
  div.innerHTML = `[${time}] ${message}`;
  logConsole.appendChild(div);
  logConsole.scrollTop = logConsole.scrollHeight;
}

// 2. Event listener for successful WebSocket connection
socket.on('connect', () => {
  addLog(`Connected to Socket.io Server (ID: ${socket.id})`, 'socket');
  addLog(`[SSR] Loaded initial seat map layout from server.`, 'success');
});

socket.on('disconnect', () => {
  addLog('Disconnected from Socket.io Server.', 'error');
});

// 3. Listen for real-time seat update events from server
socket.on('seat_updated', (data) => {
  const currentTicketId = parseInt(ticketIdInput.value);
  if (data.ticketId !== currentTicketId) return;

  addLog(`[WS UPDATE] Seat <b>${data.seatNumber}</b> updated to <b>${data.status}</b>` + 
         (data.reservedBy ? ` (User: ${data.reservedBy})` : ''), 'socket');

  const seatButton = document.getElementById(`seat-${data.seatNumber}`);
  if (seatButton) {
    updateSeatButtonUI(seatButton, data.status);
  }
});

// 4. Load seat map dynamically using Axios when Ticket ID changes
async function loadSeats() {
  const ticketId = ticketIdInput.value;
  if (!ticketId) return;

  addLog(`[AXIOS] Fetching seat map for Ticket #${ticketId}...`);
  seatGrid.innerHTML = '<div class="text-gray-500 text-sm py-4 col-span-10 text-center">Loading seat map...</div>';
  
  try {
    const response = await axios.get(`/api/tickets/${ticketId}/seats`);
    const seats = response.data;
    
    seatGrid.innerHTML = '';
    seats.forEach(seat => {
      const btn = document.createElement('button');
      btn.id = `seat-${seat.seatNumber}`;
      btn.innerText = seat.seatNumber;
      btn.dataset.seatNumber = seat.seatNumber;
      btn.dataset.status = seat.status;
      
      btn.className = `p-3 text-xs font-bold rounded-lg border transition duration-200 focus:outline-none flex flex-col items-center justify-center min-h-[50px]`;
      updateSeatButtonUI(btn, seat.status);

      btn.onclick = function() { selectSeat(btn); };
      seatGrid.appendChild(btn);
    });

    addLog(`[AXIOS] Successfully loaded seat map with ${seats.length} seats.`, 'success');
    resetSelection();
  } catch (err) {
    seatGrid.innerHTML = '<div class="text-red-500 text-sm py-4 col-span-10 text-center">Error loading seat map. Please ensure Postgres and services are running.</div>';
    addLog('[AXIOS] Failed to load seat map.', 'error');
  }
}

// Update seat button styles based on status
function updateSeatButtonUI(btn, status) {
  btn.dataset.status = status;
  btn.className = btn.className.replace(/bg-\S+/g, '').replace(/border-\S+/g, '').replace(/text-\S+/g, '').replace(/neon-glow-\S+/g, '');
  
  if (status === 'available') {
    btn.className += ' bg-emerald-950/20 border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/30 hover:border-emerald-500 hover:text-white cursor-pointer';
  } else if (status === 'reserved') {
    btn.className += ' bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse cursor-pointer neon-glow-amber';
  } else if (status === 'booked') {
    btn.className += ' bg-red-950/30 border-red-900/40 text-red-500 cursor-not-allowed opacity-50';
  }
}

// Select a seat (Globally registered function for EJS click handler)
window.selectSeat = function(btn) {
  if (btn.dataset.status === 'booked') {
    addLog(`Seat ${btn.dataset.seatNumber} is already booked and cannot be selected.`, 'warning');
    return;
  }

  if (currentSelectedSeat) {
    const oldBtn = document.getElementById(`seat-${currentSelectedSeat}`);
    if (oldBtn) updateSeatButtonUI(oldBtn, oldBtn.dataset.status);
  }

  currentSelectedSeat = btn.dataset.seatNumber;
  selectedSeatInput.value = currentSelectedSeat;

  btn.className += ' ring-2 ring-emerald-400 border-transparent';

  reserveBtn.disabled = false;
  reserveBtn.className = 'w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-2 rounded-lg text-sm transition duration-200 shadow-md shadow-emerald-950/20 cursor-pointer';
};

// Reset current selection state
function resetSelection() {
  currentSelectedSeat = null;
  selectedSeatInput.value = '';
  reserveBtn.disabled = true;
  reserveBtn.className = 'w-full bg-gray-800 text-gray-500 font-semibold py-2 rounded-lg cursor-not-allowed text-sm transition duration-200';
}

// 5. Submit seat reservation request via Axios
async function reserveSeat() {
  const ticketId = parseInt(ticketIdInput.value);
  const userId = parseInt(userIdInput.value);
  
  if (!currentSelectedSeat || !ticketId || !userId) return;

  addLog(`[AXIOS] Sending reservation request for seat ${currentSelectedSeat}...`);
  
  try {
    const response = await axios.post('/api/seats/reserve', {
      ticketId,
      seatNumber: currentSelectedSeat,
      userId,
    });

    const data = response.data;
    addLog(`[AXIOS] Reservation successful: Seat ${data.seat.seatNumber} locked for 5 minutes.`, 'success');
    resetSelection();
  } catch (err) {
    const errMsg = err.response && err.response.data && err.response.data.error 
      ? err.response.data.error 
      : err.message;
    addLog(`[AXIOS] Reservation failed: ${errMsg}`, 'error');
  }
}

// Event Listeners
loadBtn.addEventListener('click', loadSeats);
reserveBtn.addEventListener('click', reserveSeat);
clearLogsBtn.addEventListener('click', () => {
  logConsole.innerHTML = '<div class="text-gray-600">[SYSTEM] Logs cleared.</div>';
});
