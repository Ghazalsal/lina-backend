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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(
  cors({
    origin: [
      'https://lina-pure-nails.ps',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ],
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get('/', (_req, res) => {
  res.json({ message: 'Appointments API Server', status: 'running' });
});

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI missing');
  process.exit(1);
}
mongoose
  .connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// GET /api/appointments?date=YYYY-MM-DD
app.get(
  '/api/appointments',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { date } = req.query;

      if (!date || typeof date !== 'string') {
      res.status(400).json({ error: 'Date parameter is required' });
        return;
      }

      const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

      const appointments = await Appointment.find({
        time: { $gte: startOfDay, $lte: endOfDay },
      }).sort({ time: 1 });

    const transformedAppointments = appointments.map((appointment) => ({
      id: appointment._id.toString(),
      name: appointment.name,
      phone: appointment.phone,
      type: appointment.type,
      time: appointment.time.toISOString(),
      notes: appointment.notes,
    }));

    res.json(transformedAppointments);
  })
);

app.get(
  '/api/appointments/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Appointment ID is required' });
      return;
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    res.json({
      id: appointment._id.toString(),
      name: appointment.name,
      phone: appointment.phone,
      type: appointment.type,
      time: appointment.time.toISOString(),
      notes: appointment.notes,
    });
  })
);

app.post(
  '/api/appointments',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, phone, type, time, notes, date } = req.body;

    if (!name || !phone || !type || !time) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    try {
      let appointmentTime: Date;
      if (/^\d{2}:\d{2}$/.test(time)) {
        const [hours, minutes] = time.split(':').map(Number);

        if (date) {
          const [year, month, day] = date.split('-').map(Number);
          appointmentTime = new Date(year, month - 1, day, hours, minutes);
        } else {
          const today = new Date();
          appointmentTime = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            hours,
            minutes
          );
        }
      } else {
        appointmentTime = new Date(time);
      }

      if (isNaN(appointmentTime.getTime())) {
        res.status(400).json({ error: 'Invalid time format' });
        return;
      }

      const appointment = new Appointment({
        name,
        phone,
        type,
        time: appointmentTime,
        notes,
      });

      const saved = await appointment.save();

      res.status(201).json({
        id: saved._id.toString(),
        name: saved.name,
        phone: saved.phone,
        type: saved.type,
        time: saved.time.toISOString(),
        notes: saved.notes,
      });
    } catch (error) {
      console.error('❌ Error fetching appointments:', error);
      res.status(500).json({ error: 'Failed to fetch appointments' });
    }
  })
);

app.put(
  '/api/appointments/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, phone, type, time, notes, date } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Appointment ID is required' });
      return;
    }

    try {
      const update: any = {};
      if (name !== undefined) update.name = name;
      if (phone !== undefined) update.phone = phone;
      if (type !== undefined) update.type = type;

      if (time !== undefined) {
        let appointmentTime: Date;
        if (/^\d{2}:\d{2}$/.test(time)) {
          const [hours, minutes] = time.split(':').map(Number);

          if (date) {
            const [year, month, day] = date.split('-').map(Number);
            appointmentTime = new Date(year, month - 1, day, hours, minutes);
          } else {
            const today = new Date();
            appointmentTime = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
              hours,
              minutes
            );
          }
        } else {
          appointmentTime = new Date(time);
        }

        if (isNaN(appointmentTime.getTime())) {
          res.status(400).json({ error: 'Invalid time format' });
          return;
        }
        update.time = appointmentTime;
      }

      if (notes !== undefined) update.notes = notes;

      const updated = await Appointment.findByIdAndUpdate(id, update, {
        new: true,
      });

      if (!updated) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
      }

      res.json({
        id: updated._id.toString(),
        name: updated.name,
        phone: updated.phone,
        type: updated.type,
        time: updated.time.toISOString(),
        notes: updated.notes,
      });
    } catch (error) {
      console.error('❌ Reminder sending error:', error);
      res.status(500).json({ success: false, error: 'Failed to send reminders' });
    }
  })
);

app.delete(
  '/api/appointments/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Appointment ID is required' });
      return;
    }

    const deleted = await Appointment.findByIdAndDelete(id);

    if (!deleted) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    res.json({ message: 'Appointment deleted', id });
  })
);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function sendTomorrowAppointmentReminders() {
  try {
    console.log(
      "🔔 Running scheduled task: Sending reminders for tomorrow's appointments"
    );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

    const year = tomorrow.getFullYear();
    const month = tomorrow.getMonth();
    const day = tomorrow.getDate();

    const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

  const appointments = await Appointment.find({
      time: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ time: 1 });

    console.log(`Found ${appointments.length} appointments for tomorrow`);

    for (const appointment of appointments) {
      if (!appointment.phone || appointment.phone.trim() === '') {
        console.log(`Skipping reminder for ${appointment.name} - No phone number`);
        continue;
      }

      let serviceInArabic: string;
      switch (appointment.type) {
        case AppointmentType.Manicure:
          serviceInArabic = 'مانيكير';
          break;
        case AppointmentType.Pedicure:
          serviceInArabic = 'باديكير';
          break;
        case AppointmentType.Both:
          serviceInArabic = 'مانيكير و باديكير';
          break;
        default:
          serviceInArabic = appointment.type;
      }

      const hours = appointment.time.getHours().toString().padStart(2, '0');
      const minutes = appointment.time.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      const formattedDate = `${day.toString().padStart(2, '0')}/${(month + 1)
        .toString()
        .padStart(2, '0')}/${year}`;

      const success = await sendWhatsAppMessage(
        appointment.phone,
        appointment.name,
        formattedDate,
        timeString,
        serviceInArabic
      );

      if (success) {
        console.log(`✅ Reminder sent to ${appointment.name} (${appointment.phone})`);
      } else {
        console.error(`❌ Failed to send reminder to ${appointment.name} (${appointment.phone})`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000)); // avoid flooding
    }

    console.log("🏁 Finished sending reminders for tomorrow's appointments");
  } catch (error) {
    console.error('❌ Error sending reminders:', error);
  }
}

cron.schedule('0 20 * * *', sendTomorrowAppointmentReminders, {
  timezone: 'Asia/Riyadh',
});

// API endpoint to manually trigger reminders
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
      console.error('❌ Server startup error:', err);
      process.exit(1);
    }
  });
  return server
};

startServer(PORT);
