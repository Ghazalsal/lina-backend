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
  const localTargetHour = 17;
  const cronExpr = `0 ${localTargetHour} * * *`;

  console.log("⚙️ Reminder scheduler config:", { timezone: tz, cronExpr });

  cron.schedule(
    cronExpr,
    async () => {
      console.log("🕗 Running SMS reminder scheduler...");

      // existing code...
    },
    { timezone: tz }
  );
}