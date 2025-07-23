"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const node_cron_1 = __importDefault(require("node-cron"));
const Appointment_1 = require("./models/Appointment");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
    credentials: true,
}));
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.json({ message: 'Appointments API Server', status: 'running' });
});
mongoose_1.default.connect('mongodb://localhost:27017/appointments')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));
app.get('/api/appointments', (0, express_async_handler_1.default)(async (req, res) => {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
        res.status(400).json({ error: 'Date parameter is required' });
        return;
    }
    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    const appointments = await Appointment_1.Appointment.find({
        time: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ time: 1 });
    const transformedAppointments = appointments.map(appointment => ({
        id: appointment._id.toString(),
        name: appointment.name,
        phone: appointment.phone,
        type: appointment.type,
        time: appointment.time.toISOString(),
        notes: appointment.notes
    }));
    res.json(transformedAppointments);
}));
app.get('/api/appointments/:id', (0, express_async_handler_1.default)(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Appointment ID is required' });
        return;
    }
    const appointment = await Appointment_1.Appointment.findById(id);
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
        notes: appointment.notes
    });
}));
app.post('/api/appointments', (0, express_async_handler_1.default)(async (req, res) => {
    const { name, phone, type, time, notes, date } = req.body;
    if (!name || !phone || !type || !time) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }
    try {
        let appointmentTime;
        if (time.match(/^\d{2}:\d{2}$/)) {
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
        const appointment = new Appointment_1.Appointment({
            name,
            phone,
            type,
            time: appointmentTime,
            notes
        });
        const saved = await appointment.save();
        res.status(201).json({
            id: saved._id.toString(),
            name: saved.name,
            phone: saved.phone,
            type: saved.type,
            time: saved.time.toISOString(),
            notes: saved.notes
        });
    }
    catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
}));
app.put('/api/appointments/:id', (0, express_async_handler_1.default)(async (req, res) => {
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
            if (time.match(/^\d{2}:\d{2}$/)) {
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
        const updated = await Appointment_1.Appointment.findByIdAndUpdate(id, update, { new: true });
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
            notes: updated.notes
        });
    }
    catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
}));
app.delete('/api/appointments/:id', (0, express_async_handler_1.default)(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Appointment ID is required' });
        return;
    }
    const deleted = await Appointment_1.Appointment.findByIdAndDelete(id);
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
        console.log('🔔 Running scheduled task: Sending reminders for tomorrow\'s appointments');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const year = tomorrow.getFullYear();
        const month = tomorrow.getMonth();
        const day = tomorrow.getDate();
        const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
        const appointments = await Appointment_1.Appointment.find({
            time: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ time: 1 });
        console.log(`Found ${appointments.length} appointments for tomorrow`);
        for (const appointment of appointments) {
            if (!appointment.phone || appointment.phone.trim() === "") {
                console.log(`Skipping reminder for ${appointment.name} - No phone number`);
                continue;
            }
            let serviceInArabic;
            switch (appointment.type) {
                case Appointment_1.AppointmentType.Manicure:
                    serviceInArabic = "مانيكير";
                    break;
                case Appointment_1.AppointmentType.Pedicure:
                    serviceInArabic = "باديكير";
                    break;
                case Appointment_1.AppointmentType.Both:
                    serviceInArabic = "مانيكير و باديكير";
                    break;
                default:
                    serviceInArabic = appointment.type;
            }
            const hours = appointment.time.getHours().toString().padStart(2, '0');
            const minutes = appointment.time.getMinutes().toString().padStart(2, '0');
            const timeString = `${hours}:${minutes}`;
            const formattedDate = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`;
            const success = await (0, WhatsAppAPI_1.sendWhatsAppMessage)(appointment.phone, appointment.name, formattedDate, timeString, serviceInArabic);
            if (success) {
                console.log(`✅ Reminder sent to ${appointment.name} (${appointment.phone})`);
            }
            else {
                console.error(`❌ Failed to send reminder to ${appointment.name} (${appointment.phone})`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('🏁 Finished sending reminders for tomorrow\'s appointments');
    }
    catch (error) {
        console.error('❌ Error sending reminders:', error);
    }
}
node_cron_1.default.schedule('0 20 * * *', sendTomorrowAppointmentReminders, {
    // scheduled: true,
    timezone: "Asia/Riyadh"
});
// Add an API endpoint to manually trigger reminders
app.post('/api/send-tomorrow-reminders', (0, express_async_handler_1.default)(async (req, res) => {
    try {
        await sendTomorrowAppointmentReminders();
        res.json({ success: true, message: 'Reminders for tomorrow\'s appointments have been sent' });
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
        console.log(`📅 Scheduled task: Reminders for tomorrow's appointments will be sent at 8:00 PM daily`);
    });
    server.on('error', (err) => {
        if (err?.name === 'EADDRINUSE') {
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
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const WhatsAppAPI_1 = require("./utils/WhatsAppAPI");
// Support __dirname in ESModules or TS
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
// Serve static frontend files
app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
// Handle frontend routing (for React/Vite apps)
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'public', 'index.html'));
});
