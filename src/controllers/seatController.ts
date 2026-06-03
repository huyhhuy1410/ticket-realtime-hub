import { Request, Response } from 'express';
import { SeatService } from '../services/seatService';

export class SeatController {
  /**
   * Fetch seat map layout by Ticket ID
   */
  static async getSeats(req: Request, res: Response) {
    try {
      const ticketId = parseInt(req.params.ticketId);
      if (isNaN(ticketId)) {
        return res.status(400).json({ error: 'Invalid Ticket ID.' });
      }

      const seats = await SeatService.getSeatsByTicket(ticketId);
      return res.json(seats);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Request a temporary seat reservation lock
   */
  static async reserve(req: Request, res: Response) {
    try {
      const { ticketId, seatNumber, userId } = req.body;

      if (!ticketId || !seatNumber || !userId) {
        return res.status(400).json({ error: 'Missing required parameters: ticketId, seatNumber, or userId.' });
      }

      const seat = await SeatService.reserveSeat(
        parseInt(ticketId),
        seatNumber,
        parseInt(userId)
      );

      // Broadcast real-time seat status update via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.emit('seat_updated', {
          ticketId: seat.ticketId,
          seatNumber: seat.seatNumber,
          status: seat.status,
          reservedBy: seat.reservedBy,
        });
      }

      return res.json({
        message: 'Seat successfully reserved for 5 minutes.',
        seat,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * Receive payment confirmation callback from Laravel Core
   * Transitions seat reservation from "reserved" to permanent "booked"
   */
  static async confirmBooking(req: Request, res: Response) {
    try {
      const { ticketId, seatNumber } = req.body;

      if (!ticketId || !seatNumber) {
        return res.status(400).json({ error: 'Missing required parameters: ticketId or seatNumber.' });
      }

      const seat = await SeatService.confirmSeatBooking(
        parseInt(ticketId),
        seatNumber
      );

      // Broadcast finalized seat status update to all connected clients
      const io = req.app.get('io');
      if (io) {
        io.emit('seat_updated', {
          ticketId: seat.ticketId,
          seatNumber: seat.seatNumber,
          status: seat.status,
          reservedBy: null,
        });
      }

      return res.json({
        message: 'Successfully confirmed booking.',
        seat,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
