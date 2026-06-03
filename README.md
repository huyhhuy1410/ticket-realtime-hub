# Ticket Real-time Hub (Node.js & TypeScript WebSockets)

A high-performance real-time seat reservation engine built with Express, TypeScript, Socket.io, and Redis. It operates as the dynamic inventory locking layer for travel bookings, coordinating with the **Travel Distribution Core** (Laravel 12 API) to lock, release, and confirm passenger seating maps.

---

## Key Backend Engineering Features

1. **Redis Distributed Locking (Atomic Hold)**
   Guarantees that a seat cannot be locked by two concurrent users. The seat is locked in Redis using `SET seat_lock:ticketId:seatNumber userId EX 300 NX`. If the lock key already exists, the reservation request is rejected immediately.
2. **Lazy Expiry Cleanup**
   Avoids expensive polling timers. When a client requests a seat map, the system automatically checks any currently "reserved" seats against Redis. If the corresponding Redis lock has expired, the database status of the seat is lazily set back to `available` and cleared.
3. **WebSockets Synchronization (Socket.io)**
   Propagates real-time state changes instantly. Whenever a seat is reserved, released, or permanently booked (purchased), the status is broadcast to all active map views.
4. **Debian Slim Containerization**
   Fully containerized using a Node Debian-slim base image containing OpenSSL, configured to bind to a local multi-container network with Postgres and Redis.

---

## Technology Stack

*   **Runtime:** Node.js 18+ (TypeScript)
*   **Web Framework:** Express
*   **Database ORM:** Prisma Client
*   **Relational Database:** PostgreSQL 15
*   **Locking & Sync:** Redis
*   **WebSockets:** Socket.io
*   **View Engine:** EJS (Server-Side Rendered initial state)
*   **HTTP Client:** Axios (for client-to-server reservation updates)

---

## Installation & Setup Guide

### Prerequisites
*   Docker & Docker Desktop installed.

### Start the Application Services
1. Clone the project and navigate to the directory:
   ```bash
   cd ticket-realtime-hub
   ```
2. Copy the example environment variables:
   ```bash
   cp .env.example .env
   ```
3. Build and launch the containers (Node app, Postgres, and Redis):
   ```bash
   docker compose up -d --build
   ```
4. Push the Prisma database schema into PostgreSQL (automatically configures tables):
   ```bash
   docker exec -it ticket_realtime_app npx prisma db push
   ```
5. View the container log statements to verify connection:
   ```bash
   docker logs -f ticket_realtime_app
   ```
6. Open your browser and navigate to the Web UI:
   ```
   http://localhost:3000
   ```

---

## Testing Real-time Seat Actions (API Walkthrough)

### 1. Request a Seat Reservation (Lock)
Simulate a collaborator (User ID `22`) locking seat `A05` for Ticket `1`. The UI log console will instantly display the Axios call and the Socket.io event:
```bash
curl -X POST http://localhost:3000/api/seats/reserve \
     -H "Content-Type: application/json" \
     -d '{"ticketId": 1, "seatNumber": "A05", "userId": 22}'
```
*Expected response: Success message, seat updated to status `reserved`. Redis lock is created with a 5-minute expiry.*

### 2. Confirm the Booking (Laravel Payment Callback)
Simulate the payment completion notification sent by Laravel Core to finalize the seat booking:
```bash
curl -X POST http://localhost:3000/api/seats/confirm \
     -H "Content-Type: application/json" \
     -d '{"ticketId": 1, "seatNumber": "A05"}'
```
*Expected response: Status updated to `booked`, Redis lock is released, and all connected browsers receive the Socket.io update.*

---

## Directory Structure Overview

*   `src/server.ts` - Main server file configuring Express, HTTP, Socket.io, and serving static files.
*   `src/routes/seatRoutes.ts` - Declares endpoints for map views, holds, and confirmation callbacks.
*   `src/controllers/seatController.ts` - Parses payloads and broadcasts Socket.io status updates.
*   `src/services/seatService.ts` - Handles Redis locks (`EX`, `NX`), Prisma client queries, and lazy cleanup.
*   `views/index.ejs` - Elegant dark-mode glassmorphic seat selection dashboard.
*   `public/js/seatmap.js` - Real-time Socket.io list updates and Axios client request handlers.
