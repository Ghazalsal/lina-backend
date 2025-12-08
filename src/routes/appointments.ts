// utils/whatsappScheduler.ts
import cron from "node-cron";
import { Appointment } from "../models/Appointment.js";
import { IUser } from "../models/User.js";
import { sendWhatsAppMessage } from "../utils/WhatsAppAPI.js";

export function scheduleWhatsAppReminders() {
  // Run daily at 8 PM
  cron.schedule("0 20 * * *", async () => {
    console.log("🕗 Running WhatsApp reminder scheduler...");

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Skip Sundays
    if (tomorrow.getDay() === 0) {
      console.log("⏩ Skipping Sunday reminders");
      return;
    }

    const appointments = await Appointment.find({
      time: { $gte: tomorrow, $lte: tomorrowEnd },
    })
      .populate<{ userId: IUser }>("userId")
      .exec();

    if (!appointments.length) {
      console.log("No appointments for tomorrow.");
      return;
    }

    const daysArabic = [
      "الأحد",
      "الإثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت",
    ];

    const serviceTranslations: Record<string, string> = {
      MANICURE: "مانيكير",
      PEDICURE: "بيديكير",
      BOTH_BASIC: "مانيكير و باديكير أساسي",
      BOTH_FULL: "مانيكير و باديكير كامل",
      EYEBROWS: "حواجب",
      LASHES: "رموش",
    };

    for (const appt of appointments) {
      const user = appt.userId;
      if (!user?.phone) continue;

      const date = appt.time.toLocaleDateString("en-GB");
      const timeStr = appt.time.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dayName = daysArabic[appt.time.getDay()];

      const serviceAr = serviceTranslations[appt.type] || appt.type;

      try {
        // Use structured path: sends IMAGE ONLY with Arabic caption
        await sendWhatsAppMessage(
          user.phone,
          user.name,
          date,
          timeStr,
          serviceAr,
          dayName,
          "ar"
        );
        console.log(`✅ Reminder sent to ${user.name}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${user.name}:`, err);
      }
    }
  });
}

