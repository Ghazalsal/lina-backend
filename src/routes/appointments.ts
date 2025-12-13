// utils/whatsappScheduler.ts
import cron from "node-cron";
import { Appointment, AppointmentType } from "../models/Appointment.js";
import { IUser } from "../models/User.js";
import { sendWhatsAppMessage } from "../utils/WhatsAppAPI.js";

function resolveTimezone(): string {
  const candidates = [
    process.env.DEFAULT_TIMEZONE,
    "Asia/Gaza",
    "Asia/Jerusalem",
    "Europe/Athens",
  ].filter(Boolean) as string[];
  for (const tz of candidates) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
      return tz;
    } catch {}
  }
  return "UTC";
}

function getOffsetMinutes(): number {
  const raw = (process.env.TZ_OFFSET_MINUTES || "").trim();
  const n = Number(raw);
  if (!isNaN(n) && isFinite(n)) return n;
  // Default to +120 (UTC+2) which is winter offset for Gaza/Jerusalem
  return 120;
}

function formatWithOffset(date: Date, lang: string) {
  const offset = getOffsetMinutes();
  const shifted = new Date(date.getTime() + offset * 60000);
  const h = shifted.getUTCHours();
  const m = shifted.getUTCMinutes();
  const dd = shifted.getUTCDate();
  const mm = shifted.getUTCMonth() + 1;
  const yyyy = shifted.getUTCFullYear();
  const weekdayIdx = shifted.getUTCDay();

  // Time 12h
  const isPM = h >= 12;
  const h12 = h % 12 || 12;
  const mmStr = m.toString().padStart(2, "0");
  const timeStr = `${h12}:${mmStr} ${isPM ? "pm" : "am"}`;

  // Date dd/mm/yyyy
  const dateStr = `${dd.toString().padStart(2, "0")}/${mm.toString().padStart(2, "0")}/${yyyy}`;

  // Weekday name (Arabic)
  const daysArabic = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];
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
  const tzIsUTC = tz === "UTC";

  // Compute the cron hour: if timezone unavailable (UTC), convert local 20:00 to UTC hour using offset
  const localTargetHour = 20; // 8 PM local target
  const offsetHours = Math.floor(getOffsetMinutes() / 60);
  const cronHour = tzIsUTC ? ((localTargetHour - offsetHours + 24) % 24) : localTargetHour;
  const cronExpr = `0 ${cronHour} * * *`;

  console.log("⚙️ Reminder scheduler config:", { timezone: tz, cronExpr, offsetMinutes: getOffsetMinutes() });

  // Schedule daily job
  cron.schedule(
    cronExpr,
    async () => {
      console.log("🕗 Running WhatsApp reminder scheduler...", { timezone: tz });

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);
      const targetDayKey = formatDayKey(tomorrow);

      // Skip Sundays
      if (tomorrow.getDay() === 0) {
        console.log("⏩ Skipping Sunday reminders");
        return;
      }

      const appointments = await Appointment.find({
        time: { $gte: tomorrow, $lte: tomorrowEnd },
        $or: [
          { lastReminderSentForDay: { $exists: false } },
          { lastReminderSentForDay: { $ne: targetDayKey } },
        ],
      })
        .populate<{ userId: IUser }>("userId")
        .exec();

      if (!appointments.length) {
        console.log("No appointments for tomorrow.");
        return;
      }

      const serviceTranslations: Record<AppointmentType, string> = {
        [AppointmentType.Manicure]: "مانيكير",
        [AppointmentType.Pedicure]: "بيديكير",
        [AppointmentType.BothBasic]: "مانيكير و باديكير أساسي",
        [AppointmentType.BothFull]: "مانيكير و باديكير كامل",
        [AppointmentType.Eyebrows]: "حواجب",
        [AppointmentType.Lashes]: "رموش",
      };

      for (const appt of appointments) {
        const user = appt.userId;
        if (!user?.phone) continue;

        // Claim appointment atomically to prevent duplicate sends across processes
        const claim = await Appointment.updateOne(
          {
            _id: appt._id,
            $or: [
              { lastReminderSentForDay: { $exists: false } },
              { lastReminderSentForDay: { $ne: targetDayKey } },
            ],
          },
          {
            $set: { lastReminderSentForDay: targetDayKey, lastReminderSentAt: new Date() },
          }
        );
        if (!claim.modifiedCount) {
          continue;
        }

        let date: string;
        let timeStr: string;
        let dayName: string;

        if (!tzIsUTC) {
          date = new Intl.DateTimeFormat("en-GB", { timeZone: tz }).format(appt.time);
          timeStr = new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: tz,
          }).format(appt.time);
          dayName = new Intl.DateTimeFormat("ar-EG", { weekday: "long", timeZone: tz }).format(
            appt.time
          );
        } else {
          const f = formatWithOffset(appt.time, "ar");
          date = f.dateStr;
          timeStr = f.timeStr;
          dayName = f.dayNameAr;
        }

        const serviceAr =
          serviceTranslations[appt.type as AppointmentType] || String(appt.type);
console.log({appt, TIME: timeStr })
        try {
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
          // Optionally release claim on failure so it can be retried manually
          // await Appointment.updateOne(
          //   { _id: appt._id, lastReminderSentForDay: targetDayKey },
          //   { $unset: { lastReminderSentForDay: "", lastReminderSentAt: "" } }
          // );
        }
      }
    },
    { timezone: tz }
  );
}

