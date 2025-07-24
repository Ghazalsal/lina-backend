/* eslint-disable @typescript-eslint/no-explicit-any */
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Appointment, AppointmentType } from './models/Appointment.js';
import { sendWhatsAppMessage } from './utils/WhatsAppAPI.js';

dotenv.config();

const app = express();

// Set up __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: [
      'https://lina-pure-nails.ps',  // your frontend deployed domain
      'http://localhost:5173',        // optional for local dev
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ],
    credentials: true,
  })
);

app.use(express.json());

// API status check
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Appointments API Server', status: 'running' });
});

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("❌ Missing MONGODB_URI in environment");
  process.exit(1);
}

console.log("Mongo URI:", mongoUri);

mongoose
  .connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Your API routes here (GET, POST, PUT, DELETE) ---
// ... [keep all your existing API routes exactly as you have them] ...

// Scheduled job to send WhatsApp reminders
async function sendTomorrowAppointmentReminders() {
  // ... [keep your existing cron job code as-is] ...
}

cron.schedule('0 20 * * *', sendTomorrowAppointmentReminders, {
  timezone: 'Asia/Riyadh',
});

app.post(
  '/api/send-tomorrow-reminders',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      await sendTomorrowAppointmentReminders();
      res.json({ success: true, message: "Reminders for tomorrow's appointments have been sent" });
    } catch (error) {
      console.error('Error sending reminders:', error);
      res.status(500).json({ success: false, error: 'Failed to send reminders' });
    }
  })
);

// --- Serve React frontend static files ---
// IMPORTANT: Place your React build folder contents here (e.g., dist or build) inside a folder named 'public_html' alongside this server file
app.use(express.static(path.join(__dirname, 'public_html')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public_html', 'index.html'));
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4002;

const startServer = (port: number, maxRetries: number = 5) => {
  if (maxRetries <= 0) {
    console.error('❌ Could not find an available port');
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
    console.log(
      "📅 Scheduled task: Reminders for tomorrow's appointments will be sent at 8:00 PM daily"
    );
  });

  server.on('error', (err: Error & { code?: string }) => {
    if (err?.code === 'EADDRINUSE') {
      console.log(`❌ Port ${port} is busy, trying port ${port + 1}`);
      server.close();
      startServer(port + 1, maxRetries - 1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });

  return server;
};

startServer(PORT);
