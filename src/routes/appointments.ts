import cron from "node-cron";
import { appointmentsDB, AppointmentType } from "../models/Appointment.js";
import { usersDB } from "../models/User.js";
import { sendWhatsAppMessage } from "../utils/WhatsAppAPI.js";

function resolveTimezone(): string {
  return process.env.DEFAULT_TIMEZONE || "Asia/Gaza";
}

function formatDayKey(date: Date, tz: string): string {
  const formatted = date.toLocaleDateString("en-CA", { timeZone: tz });
  return formatted;
}

function isSameDayInTimezone(date: Date, targetDate: Date, tz: string): boolean {
  return date.toLocaleDateString("en-CA", { timeZone: tz }) === targetDate.toLocaleDateString("en-CA", { timeZone: tz });
}

export function scheduleWhatsAppReminders() {
  const tz = resolveTimezone();
  const cronExpr = "30 18 * * *";

  console.log("⚙️ Reminder scheduler config:", { timezone: tz, cronExpr, time: "6:30 pm" });

  cron.schedule(
    cronExpr,
    async () => {
      console.log("🕗 Running WhatsApp reminder scheduler...", { timezone: tz });

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const targetDayKey = formatDayKey(tomorrow, tz);
      const allAppointments = await appointmentsDB.getAll();

      const appointments = allAppointments.filter((appt) => {
        const apptDate = new Date(appt.time);
        const sameDay = isSameDayInTimezone(apptDate, tomorrow, tz);
        const notSentForDay = !appt.lastReminderSentForDay || appt.lastReminderSentForDay !== targetDayKey;
        return sameDay && notSentForDay;
      });

      if (!appointments.length) {
        console.log("No appointments for tomorrow’s reminder window.");
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

        try {
          const dateObj = new Date(appt.time);
          const dateStr = dateObj.toLocaleDateString("en-GB", { timeZone: tz });
          const timeStr = dateObj.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: tz,
          });
          const dayName = dateObj.toLocaleDateString("ar-EG", { weekday: "long", timeZone: tz });
          const service = serviceTranslations[appt.type] || appt.type;

          await appointmentsDB.update(appt.id, {
            lastReminderSentForDay: targetDayKey,
            lastReminderSentAt: new Date().toISOString(),
          });

          const sent = await sendWhatsAppMessage(
            user.phone,
            user.name,
            dateStr,
            timeStr,
            service,
            dayName,
            "ar"
          );

          if (sent) {
            console.log(`✅ Reminder sent to ${user.name}`);
          } else {
            console.warn(`⚠️ Reminder failed for ${user.name}`);
          }
        } catch (error) {
          console.error(`❌ Failed to send reminder to ${user.name}:`, error);
        }
      }
    },
    { timezone: tz }
  );
}