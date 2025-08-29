// utils/whatsappScheduler.ts
import cron from "node-cron";
import { Appointment, IAppointment } from "../models/Appointment.js";
import { IUser } from "../models/User.js";
import { sendWhatsAppMessage } from "../utils/WhatsAppAPI.js";

export function scheduleWhatsAppReminders() {
  // Run daily at 8pm
  cron.schedule("0 20 * * *", async () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Skip Sundays (0 = Sunday)
    if (tomorrow.getDay() === 0) {
      console.log("Skipping reminders for Sunday");
      return;
    }

    // populate userId (not "user")
    const appointments = await Appointment.find({
      time: { $gte: tomorrow, $lte: tomorrowEnd },
    })
      .populate<{ userId: IUser }>("userId")
      .exec();

    for (const appt of appointments) {
      const user = appt.userId; // typed IUser because of populate above
      if (!user?.phone) continue;

      const date = appt.time.toLocaleDateString("en-GB");
      const timeStr = appt.time.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });

      await sendWhatsAppMessage(
        user.phone,
        user.name,
        date,
        timeStr,
        appt.type
      );
      console.log(`✅ WhatsApp reminder sent to ${user.name}`);
    }
  });
}
