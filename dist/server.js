/* eslint-disable @typescript-eslint/no-explicit-any */
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { Appointment, AppointmentType } from './models/Appointment.js';
import { sendWhatsAppMessage } from './utils/WhatsAppAPI.js';
const app = express();
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
    ],
    credentials: true,
}));
app.use(express.json());
app.get('/', (req, res) => {
    res.json({ message: 'Appointments API Server', status: 'running' });
});
mongoose
    .connect('mongodb://localhost:27017/appointments')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));
app.get('/api/appointments', asyncHandler(async (req, res) => {
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
}));
app.get('/api/appointments/:id', asyncHandler(async (req, res) => {
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
}));
app.post('/api/appointments', asyncHandler(async (req, res) => {
    const { name, phone, type, time, notes, date } = req.body;
    if (!name || !phone || !type || !time) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }
    try {
        let appointmentTime;
        if (/^\d{2}:\d{2}$/.test(time)) {
            const [hours, minutes] = time.split(':').map(Number);
            if (date) {
                const [year, month, day] = date.split('-').map(Number);
                appointmentTime = new Date(year, month - 1, day, hours, minutes);
            }
            else {
                const today = new Date();
                appointmentTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
            }
        }
        else {
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
    }
    catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
}));
app.put('/api/appointments/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, phone, type, time, notes, date } = req.body;
    if (!id) {
        res.status(400).json({ error: 'Appointment ID is required' });
        return;
    }
    try {
        const update = {};
        if (name !== undefined)
            update.name = name;
        if (phone !== undefined)
            update.phone = phone;
        if (type !== undefined)
            update.type = type;
        if (time !== undefined) {
            let appointmentTime;
            if (/^\d{2}:\d{2}$/.test(time)) {
                const [hours, minutes] = time.split(':').map(Number);
                if (date) {
                    const [year, month, day] = date.split('-').map(Number);
                    appointmentTime = new Date(year, month - 1, day, hours, minutes);
                }
                else {
                    const today = new Date();
                    appointmentTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
                }
            }
            else {
                appointmentTime = new Date(time);
            }
            if (isNaN(appointmentTime.getTime())) {
                res.status(400).json({ error: 'Invalid time format' });
                return;
            }
            update.time = appointmentTime;
        }
        if (notes !== undefined)
            update.notes = notes;
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
    }
    catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
}));
app.delete('/api/appointments/:id', asyncHandler(async (req, res) => {
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
}));
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4002;
async function sendTomorrowAppointmentReminders() {
    try {
        console.log("🔔 Running scheduled task: Sending reminders for tomorrow's appointments");
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
            let serviceInArabic;
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
            const success = await sendWhatsAppMessage(appointment.phone, appointment.name, formattedDate, timeString, serviceInArabic);
            if (success) {
                console.log(`✅ Reminder sent to ${appointment.name} (${appointment.phone})`);
            }
            else {
                console.error(`❌ Failed to send reminder to ${appointment.name} (${appointment.phone})`);
            }
            await new Promise((resolve) => setTimeout(resolve, 1000)); // avoid flooding
        }
        console.log("🏁 Finished sending reminders for tomorrow's appointments");
    }
    catch (error) {
        console.error('❌ Error sending reminders:', error);
    }
}
cron.schedule('0 20 * * *', sendTomorrowAppointmentReminders, {
    timezone: 'Asia/Riyadh',
});
// API endpoint to manually trigger reminders
app.post('/api/send-tomorrow-reminders', asyncHandler(async (req, res) => {
    try {
        await sendTomorrowAppointmentReminders();
        res.json({ success: true, message: "Reminders for tomorrow's appointments have been sent" });
    }
    catch (error) {
        console.error('Error sending reminders:', error);
        res.status(500).json({ success: false, error: 'Failed to send reminders' });
    }
}));
const startServer = (port, maxRetries = 5) => {
    if (maxRetries <= 0) {
        console.error('❌ Could not find an available port');
        process.exit(1);
    }
    const server = app.listen(port, () => {
        console.log(`🚀 Server is running on http://localhost:${port}`);
        console.log("📅 Scheduled task: Reminders for tomorrow's appointments will be sent at 8:00 PM daily");
    });
    server.on('error', (err) => {
        if (err?.code === 'EADDRINUSE') {
            console.log(`❌ Port ${port} is busy, trying port ${port + 1}`);
            server.close();
            startServer(port + 1, maxRetries - 1);
        }
        else {
            console.error('❌ Server error:', err);
            process.exit(1);
        }
    });
    return server;
};
startServer(PORT);
// --- ES Modules compatible __filename and __dirname support ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
// Handle frontend routing (React/Vite SPA)
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
