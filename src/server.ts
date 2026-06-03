import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import seatRoutes from './routes/seatRoutes';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS allowing all origins (can be restricted in production)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

import path from 'path';
import { SeatService } from './services/seatService';

app.use(cors());
app.use(express.json());

// Set up EJS View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, '../public')));

// Server-Side Rendering (SSR) via EJS: Pre-load seat layout on initial load
app.get('/', async (req, res) => {
  try {
    const ticketId = 1;
    const seats = await SeatService.getSeatsByTicket(ticketId);
    res.render('index', { ticketId, seats });
  } catch (err) {
    res.render('index', { ticketId: 1, seats: [] });
  }
});

// Attach Socket.io server to express app context for controller access
app.set('io', io);

// Mount seat management routes
app.use('/api', seatRoutes);

// Define Socket.io connection events
io.on('connection', (socket) => {
  console.log(`Client connected to Socket.io: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Realtime Ticket Hub is running at http://localhost:${PORT}`);
});
