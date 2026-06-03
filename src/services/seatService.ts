import prisma from '../config/db';
import redis from '../config/redis';

export class SeatService {
  /**
   * Load seat map for a specific Ticket ID.
   * Dynamically initializes seat layouts using ticket stock fetched from Laravel Core if none exist.
   */
  static async getSeatsByTicket(ticketId: number) {
    let seats = await prisma.seat.findMany({
      where: { ticketId },
      orderBy: { seatNumber: 'asc' },
    });

    // Fetch stock from Laravel Core if seats are not initialized yet
    if (seats.length === 0) {
      let stock = 30; // Default fallback stock

      try {
        const laravelUrl = process.env.LARAVEL_CORE_URL || 'http://localhost';
        const response = await fetch(`${laravelUrl}/api/tickets/${ticketId}`);
        if (response.ok) {
          const ticketData: any = await response.json();
          if (ticketData && typeof ticketData.stock === 'number') {
            stock = ticketData.stock;
            console.log(`Successfully fetched stock from Laravel for ticket #${ticketId}: ${stock} tickets.`);
          }
        }
      } catch (err) {
        console.error('Failed to connect to Laravel for stock check. Using default.', err);
      }

      const defaultSeats = [];
      const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const seatsPerRow = 20;

      for (let i = 0; i < stock; i++) {
        const rowIndex = Math.floor(i / seatsPerRow);
        const seatNum = (i % seatsPerRow) + 1;
        const rowLetter = rows[rowIndex] || 'Z';
        const numStr = seatNum < 10 ? `0${seatNum}` : `${seatNum}`;
        defaultSeats.push({
          ticketId,
          seatNumber: `${rowLetter}${numStr}`,
          status: 'available',
        });
      }

      await prisma.seat.createMany({
        data: defaultSeats,
      });

      seats = await prisma.seat.findMany({
        where: { ticketId },
        orderBy: { seatNumber: 'asc' },
      });
    }

    // Lazy cleanup: Release expired seat reservations whose Redis locks have timed out
    const updatedSeats = await Promise.all(
      seats.map(async (seat) => {
        if (seat.status === 'reserved') {
          const lockKey = `seat_lock:${ticketId}:${seat.seatNumber}`;
          const isLocked = await redis.get(lockKey);

          // If Redis lock is gone, reset the seat status to available
          if (!isLocked) {
            const updatedSeat = await prisma.seat.update({
              where: { id: seat.id },
              data: {
                status: 'available',
                reservedBy: null,
                reservedAt: null,
              },
            });
            return updatedSeat;
          }
        }
        return seat;
      })
    );

    return updatedSeats;
  }

  /**
   * Acquire a temporary seat reservation lock using a Redis Distributed Lock
   */
  static async reserveSeat(ticketId: number, seatNumber: string, userId: number) {
    const lockKey = `seat_lock:${ticketId}:${seatNumber}`;
    const ttlSeconds = 300; // 5 minutes TTL

    // Validate seat existence
    const seat = await prisma.seat.findUnique({
      where: {
        ticketId_seatNumber: { ticketId, seatNumber },
      },
    });

    if (!seat) {
      throw new Error('Seat does not exist.');
    }

    if (seat.status === 'booked') {
      throw new Error('Seat is already booked.');
    }

    if (seat.status === 'reserved') {
      const activeLock = await redis.get(lockKey);
      if (activeLock) {
        throw new Error('Seat is currently reserved by another client.');
      }
    }

    // Acquire lock atomically in Redis using NX flag to handle race conditions
    const acquired = await redis.set(lockKey, userId.toString(), 'EX', ttlSeconds, 'NX');

    if (!acquired) {
      throw new Error('Seat reservation was just acquired by another client.');
    }

    // Persist reservation state in PostgreSQL Database
    const updatedSeat = await prisma.seat.update({
      where: { id: seat.id },
      data: {
        status: 'reserved',
        reservedBy: userId,
        reservedAt: new Date(),
      },
    });

    return updatedSeat;
  }

  /**
   * Mark seat status as booked and release the temporary Redis lock
   */
  static async confirmSeatBooking(ticketId: number, seatNumber: string) {
    const lockKey = `seat_lock:${ticketId}:${seatNumber}`;

    const updatedSeat = await prisma.seat.update({
      where: {
        ticketId_seatNumber: { ticketId, seatNumber },
      },
      data: {
        status: 'booked',
        reservedBy: null,
        reservedAt: null,
      },
    });

    // Release Redis lock
    await redis.del(lockKey);

    return updatedSeat;
  }

  /**
   * Manually release seat reservation
   */
  static async releaseSeat(ticketId: number, seatNumber: string) {
    const lockKey = `seat_lock:${ticketId}:${seatNumber}`;

    const updatedSeat = await prisma.seat.update({
      where: {
        ticketId_seatNumber: { ticketId, seatNumber },
      },
      data: {
        status: 'available',
        reservedBy: null,
        reservedAt: null,
      },
    });

    await redis.del(lockKey);

    return updatedSeat;
  }
}
