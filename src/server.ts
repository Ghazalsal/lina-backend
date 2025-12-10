import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createWriteStream } from "fs";

import {
  Appointment,
  AppointmentType,
  ServiceDurations,
} from "./models/Appointment.js";
import { IUser, User } from "./models/User.js";
import { sendWhatsAppMessage } from "./utils/WhatsAppAPI.js";
import { scheduleWhatsAppReminders } from "./routes/appointments.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logging to file (optional)
createWriteStream(path.join(__dirname, "access.log"), { flags: "a" });

// CORS
app.use(
  cors({
    origin: [
      "https://lina-pure-nails.ps",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// JSON body parser with validation
app.use(
  express.json({
    limit: "10mb",
    verify: (_req, _res, buf) => {
      try {
        JSON.parse(buf.toString() || "{}");
      } catch {
        throw new Error("Invalid JSON");
      }
    },
  })
);

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(
    `\n--- NEW REQUEST ---\n${new Date().toISOString()} ${req.method} ${
      req.path
    }`
  );
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

// In your server.js or route file
app.post(
  "/api/appointments/:id/send-whatsapp",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { lang = "en" } = req.body; // Get language from request

    const appointment = await Appointment.findById(id).populate("userId");
    if (!appointment) {
      res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
      return;
    }
    console.log({ appointmentBYBEE: appointment });
    const user = appointment.userId as IUser;
    if (!user?.phone) {
      res
        .status(400)
        .json({ success: false, message: "User has no phone number" });
      return;
    }

    // Format date and time based on language
    let date, timeStr, dayName;
    if (lang === "ar") {
      date = appointment.time.toLocaleDateString("ar-EG");
      timeStr = appointment.time.toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const daysArabic = [
        "الأحد",
        "الإثنين",
        "الثلاثاء",
        "الأربعاء",
        "الخميس",
        "الجمعة",
        "السبت",
      ];
      dayName = daysArabic[appointment.time.getDay()];
    } else {
      date = appointment.time.toLocaleDateString("en-GB");
      timeStr = appointment.time.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      dayName = appointment.time.toLocaleDateString("en-US", {
        weekday: "long",
      });
    }

    // Translate service type if needed
    let service = appointment.type as any;
    if (lang === "ar") {
      const serviceTranslations = {
        [AppointmentType.Manicure]: "مانيكير",
        [AppointmentType.Pedicure]: "بيديكير",
        [AppointmentType.BothBasic]: "مانيكير و باديكير أساسي",
        [AppointmentType.BothFull]: "مانيكير و باديكير كامل",
        [AppointmentType.Eyebrows]: "حواجب",
        [AppointmentType.Lashes]: "رموش",
      };
      service = serviceTranslations[appointment.type] || service;
    }

    const sent = await sendWhatsAppMessage(
      user.phone,
      user.name,
      date,
      timeStr,
      service,
      dayName,
      lang
    );

    if (sent) {
      res.json({
        success: true,
        message: "WhatsApp reminder sent successfully",
      });
    } else {
      res
        .status(500)
        .json({ success: false, message: "Failed to send WhatsApp reminder" });
    }
  })
);

// Health check
app.get("/", (_req, res) => {
  res.json({
    message: "Appointments API Server",
    status: "running",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});
console.log("MONGODB_URI:", process.env.MONGODB_URI);

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("❌ MONGODB_URI missing");
  process.exit(1);
}

mongoose.connection.on("connecting", () =>
  console.log("🔄 Connecting to MongoDB...")
);
mongoose.connection.on("connected", () => {
  console.log("✅ Connected to MongoDB");
  // Start daily WhatsApp reminder scheduler once DB is connected
  scheduleWhatsAppReminders();
});
mongoose.connection.on("error", (err) =>
  console.error("❌ MongoDB connection error:", err)
);
mongoose.connection.on("disconnected", () =>
  console.log("⚠️ MongoDB disconnected")
);

mongoose
  .connect(mongoUri, { connectTimeoutMS: 5000, socketTimeoutMS: 30000 })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });

/* ========================= USERS ========================= */

// Create user
app.post(
  "/api/users",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, phone } = req.body as { name?: string; phone?: string };

    if (!name?.trim() || !phone?.trim()) {
      res.status(400).json({ error: "Name and phone are required" });
      return;
    }

    const existing = await User.findOne({ phone: phone.trim() }).lean();
    if (existing) {
      res
        .status(409)
        .json({ error: "User with this phone already exists", user: existing });
      return;
    }

    const user = new User({
      name: name.trim(),
      phone: phone.trim(),
      appointments: [],
    });
    await user.save();
    res.status(201).json(user);
  })
);

// Update user
app.put(
  "/api/users/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, phone } = req.body as { name?: string; phone?: string };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }
    if (!name?.trim() || !phone?.trim()) {
      res.status(400).json({ error: "Name and phone are required" });
      return;
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { name: name.trim(), phone: phone.trim() },
      { new: true }
    );
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updated);
  })
);

// Delete user (and cascade delete their appointments)
app.delete(
  "/api/users/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // delete all appointments for this user
    await Appointment.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(user._id);

    res.json({
      success: true,
      message: "User and their appointments deleted",
      id,
    });
  })
);

// Get all users
app.get(
  "/api/users",
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ name: 1 });
    res.json(users);
  })
);

// Get single user by phone or id
app.get(
  "/api/users/search",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { phone, id } = req.query as { phone?: string; id?: string };

    let user: IUser | null = null;
    if (phone) user = await User.findOne({ phone: String(phone).trim() });
    else if (id) {
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }
      user = await User.findById(String(id));
    }

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  })
);

/* ====================== APPOINTMENTS ====================== */

// Create appointment
app.post(
  "/api/appointments",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId, type, time, notes } = req.body as {
      userId?: string;
      type?: AppointmentType;
      time?: string | Date;
      notes?: string;
    };

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: "Valid userId is required" });
      return;
    }
    if (!type || !Object.values(AppointmentType).includes(type)) {
      res.status(400).json({ error: "Valid appointment type is required" });
      return;
    }
    if (!time) {
      res.status(400).json({ error: "Appointment time is required" });
      return;
    }
    if (notes !== undefined && typeof notes !== "string") {
      res.status(400).json({ error: "Notes must be a string" });
      return;
    }

    const appointmentTime = new Date(time);
    if (isNaN(appointmentTime.getTime())) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const duration = ServiceDurations[type] ?? 45;
    const endTime = new Date(appointmentTime.getTime() + duration * 60000);

    const appointment = new Appointment({
      userId,
      type,
      time: appointmentTime,
      endTime,
      duration,
      notes: notes || "",
    });

    const saved = await appointment.save();

    // Track on user doc
    await User.updateOne(
      { _id: userId },
      { $addToSet: { appointments: saved._id } }
    );

    res.status(201).json({
      id: saved._id,
      user: { id: userId, name: user.name, phone: user.phone },
      type: saved.type,
      time: saved.time,
      endTime: saved.endTime,
      duration: saved.duration,
      notes: saved.notes,
    });
  })
);

// Update appointment
app.put(
  "/api/appointments/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, type, time, notes } = req.body as {
      userId?: string;
      type?: AppointmentType;
      time?: string | Date;
      notes?: string;
    };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid appointment ID" });
      return;
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    // If changing user, validate the new user
    let newUser: IUser | null = null;
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: "Valid userId is required" });
        return;
      }
      newUser = await User.findById(userId);
      if (!newUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }

    // Update type/duration
    if (type) {
      if (!Object.values(AppointmentType).includes(type)) {
        res.status(400).json({ error: "Valid appointment type is required" });
        return;
      }
      appointment.type = type;
      appointment.duration = ServiceDurations[type] ?? appointment.duration;
    }

    // Update time/endTime
    if (time) {
      const newTime = new Date(time);
      if (isNaN(newTime.getTime())) {
        res.status(400).json({ error: "Invalid date format" });
        return;
      }
      appointment.time = newTime;
      appointment.endTime = new Date(
        newTime.getTime() + appointment.duration * 60000
      );
    }

    if (notes !== undefined) appointment.notes = notes;

    // Handle user change: move appointment id between users
    if (newUser && appointment.userId.toString() !== newUser._id.toString()) {
      await User.updateOne(
        { _id: appointment.userId },
        { $pull: { appointments: appointment._id } }
      );
      await User.updateOne(
        { _id: newUser._id },
        { $addToSet: { appointments: appointment._id } }
      );
      appointment.userId = newUser._id;
    }

    const updated = await appointment.save();

    const finalUser = newUser
      ? { id: newUser._id, name: newUser.name, phone: newUser.phone }
      : await (async () => {
          const u = await User.findById(updated.userId).lean();
          return u
            ? { id: u._id, name: u.name, phone: u.phone }
            : { id: updated.userId };
        })();

    res.json({
      id: updated._id,
      user: finalUser,
      type: updated.type,
      time: updated.time,
      endTime: updated.endTime,
      duration: updated.duration,
      notes: updated.notes,
    });
  })
);

// Delete appointment
app.delete(
  "/api/appointments/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid appointment ID" });
      return;
    }

    const deleted = await Appointment.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    // Pull from user's appointments array
    await User.updateOne(
      { _id: deleted.userId },
      { $pull: { appointments: deleted._id } }
    );

    res.json({ message: "Appointment deleted", id: deleted._id });
  })
);

// GET /api/appointments?date=yyyy-mm-dd
app.get(
  "/api/appointments",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { date } = req.query as { date?: string };

    if (!date || typeof date !== "string") {
      res.status(400).json({ error: "Date query parameter is required" });
      return;
    }

    const startOfDay = new Date(date);
    if (isNaN(startOfDay.getTime())) {
      res.status(400).json({ error: "Invalid date" });
      return;
    }
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      time: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate("userId")
      .sort({ time: 1 })
      .lean();

    const formatted = appointments.map((apt) => ({
      id: apt._id,
      user: {
        id: (apt.userId as any)?._id ?? apt.userId,
        name: (apt.userId as any)?.name,
        phone: (apt.userId as any)?.phone,
      },
      type: apt.type,
      time: apt.time,
      endTime: apt.endTime,
      duration: apt.duration,
      notes: apt.notes,
    }));

    res.json(formatted);
  })
);

/* ===================== ERROR HANDLER ===================== */
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error("--- ERROR ---", err.stack || err.message || err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "Something went wrong",
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

/* ====================== START SERVER ===================== */
const PORT = process.env.PORT || 4002;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    try {
      await mongoose.disconnect();
      console.log("MongoDB disconnected");
    } catch (err) {
      console.error("Error closing MongoDB:", err);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}
