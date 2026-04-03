import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import asyncHandler from "express-async-handler";
import { usersDB } from "./models/User.js";
import { appointmentsDB, AppointmentType, ServiceDurations } from "./models/Appointment.js";
import { sendWhatsAppMessage } from "./utils/WhatsAppAPI.js";
import { scheduleWhatsAppReminders } from "./routes/appointments.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/* ========================= USERS ========================= */

// Create user
app.post("/api/users", asyncHandler(async (req: Request, res: Response) => {
  const { name, phone } = req.body;
  if (!name?.trim() || !phone?.trim()) {
    res.status(400).json({ error: "Name and phone are required" });
    return;
  }

  const existing = await usersDB.findOne(u => u.phone === phone.trim());
  if (existing) {
    res.status(409).json({ error: "User with this phone already exists", user: existing });
    return;
  }

  const user = await usersDB.create({
    name: name.trim(),
    phone: phone.trim(),
    appointments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  res.status(201).json(user);
}));

// Update user
app.put("/api/users/:id", asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, phone } = req.body;

  const updated = await usersDB.update(id, {
    name: name?.trim(),
    phone: phone?.trim(),
    updatedAt: new Date().toISOString()
  });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
}));

// Delete user (and cascade delete their appointments)
app.delete("/api/users/:id", asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await usersDB.getById(id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Delete all appointments for this user
  const userAppointments = await appointmentsDB.find(appt => appt.userId === id);
  for (const appt of userAppointments) {
    await appointmentsDB.delete(appt.id);
  }

  await usersDB.delete(id);
  res.json({ success: true, message: "User and their appointments deleted", id });
}));

// Get all users
app.get("/api/users", asyncHandler(async (_req, res) => {
  const users = await usersDB.getAll();
  res.json(users.sort((a, b) => a.name.localeCompare(b.name)));
}));

// Get single user by phone or id
app.get("/api/users/search", asyncHandler(async (req: Request, res: Response) => {
  const { phone, id } = req.query as { phone?: string; id?: string };
  let user;
  if (phone) user = await usersDB.findOne(u => u.phone === String(phone).trim());
  else if (id) user = await usersDB.getById(String(id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
}));

/* ====================== APPOINTMENTS ====================== */

// Create appointment
app.post("/api/appointments", asyncHandler(async (req: Request, res: Response) => {
  const { userId, type, time, notes } = req.body;

  if (!userId || !type || !time) {
    res.status(400).json({ error: "userId, type, and time are required" });
    return;
  }

  const user = await usersDB.getById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const startTime = new Date(time);
  const duration = ServiceDurations[type as AppointmentType] ?? 45;
  const endTime = new Date(startTime.getTime() + duration * 60000);

  const newAppointment = await appointmentsDB.create({
    userId,
    type,
    time: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration,
    notes: notes || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  await usersDB.update(userId, {
    appointments: [...(user.appointments || []), newAppointment.id]
  });

  res.status(201).json({
    user: { id: user.id, name: user.name, phone: user.phone },
    ...newAppointment
  });
}));

// Update appointment
app.put("/api/appointments/:id", asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, type, time, notes } = req.body;

  const appointment = await appointmentsDB.getById(id);
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  let newUser;
  if (userId && userId !== appointment.userId) {
    newUser = await usersDB.getById(userId);
    if (!newUser) {
      res.status(404).json({ error: "New user not found" });
      return;
    }
    // Move appointment between users
    const oldUser = await usersDB.getById(appointment.userId);
    if (oldUser) {
      await usersDB.update(oldUser.id, {
        appointments: oldUser.appointments.filter(aId => aId !== id)
      });
    }
    await usersDB.update(newUser.id, {
      appointments: [...(newUser.appointments || []), id]
    });
  }

  const updates: any = { updatedAt: new Date().toISOString() };
  if (userId) updates.userId = userId;
  if (type) {
    updates.type = type;
    updates.duration = ServiceDurations[type as AppointmentType] ?? appointment.duration;
  }
  if (time) {
    const startTime = new Date(time);
    updates.time = startTime.toISOString();
    const duration = updates.duration || appointment.duration;
    updates.endTime = new Date(startTime.getTime() + duration * 60000).toISOString();
  }
  if (notes !== undefined) updates.notes = notes;

  const updated = await appointmentsDB.update(id, updates);
  const finalUser = newUser || await usersDB.getById(updated!.userId);

  res.json({
    user: finalUser ? { id: finalUser.id, name: finalUser.name, phone: finalUser.phone } : { id: updated!.userId },
    ...updated
  });
}));

// Delete appointment
app.delete("/api/appointments/:id", asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const appointment = await appointmentsDB.getById(id);
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  await usersDB.update(appointment.userId, {
    appointments: (await usersDB.getById(appointment.userId))?.appointments.filter(aId => aId !== id) || []
  });

  await appointmentsDB.delete(id);
  res.json({ message: "Appointment deleted", id });
}));

// GET /api/appointments?date=yyyy-mm-dd
app.get("/api/appointments", asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.query as { date?: string };
  if (!date) {
    res.status(400).json({ error: "Date query parameter is required" });
    return;
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  const appointments = await appointmentsDB.find(appt => {
    const t = new Date(appt.time);
    return t >= startOfDay && t <= endOfDay;
  });

  const users = await usersDB.getAll();
  const formatted = appointments.map(apt => {
    const user = users.find(u => u.id === apt.userId);
    return {
      id: apt.id,
      user: user ? { id: user.id, name: user.name, phone: user.phone } : { id: apt.userId },
      type: apt.type,
      time: apt.time,
      endTime: apt.endTime,
      duration: apt.duration,
      notes: apt.notes,
    };
  });

  res.json(formatted.sort((a, b) => a.time.localeCompare(b.time)));
}));

// Send WhatsApp reminder manually
app.post("/api/appointments/:id/send-whatsapp", asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { lang = "en" } = req.body;

  const appointment = await appointmentsDB.getById(id);
  if (!appointment) {
    res.status(404).json({ success: false, message: "Appointment not found" });
    return;
  }

  const user = await usersDB.getById(appointment.userId);
  if (!user?.phone) {
    res.status(400).json({ success: false, message: "User has no phone number" });
    return;
  }

  const dateObj = new Date(appointment.time);
  let dateStr, timeStr, dayName;

  if (lang === "ar") {
    dateStr = dateObj.toLocaleDateString("ar-EG");
    timeStr = dateObj.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const daysArabic = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    dayName = daysArabic[dateObj.getDay()];
  } else {
    dateStr = dateObj.toLocaleDateString("en-GB");
    timeStr = dateObj.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
  }

  const serviceTranslations: Record<string, string> = {
    [AppointmentType.Manicure]: "مانيكير",
    [AppointmentType.Pedicure]: "بيديكير",
    [AppointmentType.BothBasic]: "مانيكير و باديكير أساسي",
    [AppointmentType.BothFull]: "مانيكير و باديكير كامل",
    [AppointmentType.Eyebrows]: "حواجب",
    [AppointmentType.Lashes]: "رموش",
  };
  const service = lang === "ar" ? (serviceTranslations[appointment.type] || appointment.type) : appointment.type;

  const sent = await sendWhatsAppMessage(
    user.phone,
    user.name,
    dateStr,
    appointment.time,
    service,
    dayName,
    lang
  );

  if (sent) {
    await appointmentsDB.update(id, { lastReminderSentAt: new Date().toISOString() });
    res.json({ success: true, message: "WhatsApp reminder sent" });
  } else {
    res.status(500).json({ success: false, message: "Failed to send WhatsApp reminder" });
  }
}));

// Health check
app.get("/", (req, res) => {
  res.json({ status: "running", storage: "json-file", version: "2.0.0" });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error("--- ERROR ---", err.stack || err.message);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  scheduleWhatsAppReminders();
});
