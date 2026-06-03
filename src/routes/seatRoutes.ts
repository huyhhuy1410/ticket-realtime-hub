import { Router } from 'express';
import { SeatController } from '../controllers/seatController';

const router = Router();

// Fetch seat map for a specific ticket
router.get('/tickets/:ticketId/seats', SeatController.getSeats);

// Request to reserve/lock a seat (acquires Redis lock and updates DB state)
router.post('/seats/reserve', SeatController.reserve);

// Internal webhook callback triggered by Laravel Core upon successful order payment
router.post('/seats/confirm', SeatController.confirmBooking);

export default router;
