import cron from "node-cron";
import { appointmentsDB, AppointmentType } from "../models/Appointment.js";
import { usersDB } from "../models/User.js";
import { sendWhatsAppMessage } from "../utils/WhatsAppAPI.js";

function resolveTimezone(): string {
  return process.env.DEFAULT_TIMEZONE || "Asia/Gaza";
}

function getOffsetMinutes(): number {
  return Number(process.env.TZ_OFFSET_MINUTES) || 120;
}

function formatWithOffset(date: Date) {
  const offset = getOffsetMinutes();
  const shifted = new Date(date.getTime() + offset * 60000);
  const h = shifted.getUTCHours();
  const m = shifted.getUTCMinutes();
  const dd = shifted.getUTCDate();
  const mm = shifted.getUTCMonth() + 1;
  const yyyy = shifted.getUTCFullYear();
  const weekdayIdx = shifted.getUTCDay();

  const isPM = h >= 12;
  const h12 = h % 12 || 12;
  const mmStr = m.toString().padStart(2, "0");
  const timeStr = `${h12}:${mmStr} ${isPM ? "pm" : "am"}`;
  const dateStr = `${dd.toString().padStart(2, "0")}/${mm.toString().padStart(2, "0")}/${yyyy}`;

  const daysArabic = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const dayNameAr = daysArabic[weekdayIdx];

  return { dateStr, timeStr, dayNameAr };
}

function formatDayKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function scheduleWhatsAppReminders() {
  const tz = resolveTimezone();
  const localTargetHour = 20; // 8 PM
  const cronExpr = `0 ${localTargetHour} * * *`;

  console.log("⚙️ Reminder scheduler config:", { timezone: tz, cronExpr });

  cron.schedule(cronExpr, async () => {
    console.log("🕗 Running WhatsApp reminder scheduler...");

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    const targetDayKey = formatDayKey(tomorrow);

    if (tomorrow.getDay() === 0) return; // Skip Sunday

    const appointments = await appointmentsDB.find(appt => {
      const apptTime = new Date(appt.time);
      return apptTime >= tomorrow && apptTime <= tomorrowEnd && appt.lastReminderSentForDay !== targetDayKey;
    });

    if (!appointments.length) {
      console.log("No appointments for tomorrow.");
      return;
    }

    const serviceTranslations: Record<string, string> = {
      [AppointmentType.Manicure]: "مانيكير",
      [AppointmentType.Pedicure]: "بيديكير",
      [AppointmentType.BothBasic]: "مانيكير و باديكير أساسي",
      [AppointmentType.BothFull]: "مانيكير و باديكير كامل",
      [AppointmentType.Eyebrows]: "حواجب",
      [AppointmentType.Lashes]: "رموش",
    };

    for (const appt of appointments) {
      const user = await usersDB.getById(appt.userId);
      if (!user?.phone) continue;

      const f = formatWithOffset(new Date(appt.time));
      const serviceAr = serviceTranslations[appt.type] || appt.type;

      try {
        await sendWhatsAppMessage(
          user.phone,
          user.name,
          f.dateStr,
          appt.time,
          serviceAr,
          f.dayNameAr,
          "ar"
        );
        await appointmentsDB.update(appt.id, {
          lastReminderSentForDay: targetDayKey,
          lastReminderSentAt: new Date().toISOString()
        });
        console.log(`✅ Reminder sent to ${user.name}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${user.name}:`, err);
      }
    }
  }, { timezone: tz });
}
