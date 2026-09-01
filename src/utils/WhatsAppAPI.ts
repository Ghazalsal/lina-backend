import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

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
  return 120; // default UTC+2
}

function toPalestineTime(input: string): string {
  const maybeDate = new Date(input);
  if (!isNaN(maybeDate.getTime())) {
    const tz = resolveTimezone();
    // Use en-US for reliable 12-hour formatting (12:00 pm instead of 00:00)
    const fmtTZ = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    }).format(maybeDate).toLowerCase();

    const fmtUTC = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }).format(maybeDate).toLowerCase();

    const forceOffset = String(process.env.FORCE_TZ_OFFSET || "").toLowerCase() === "true";
    if (forceOffset || fmtTZ === fmtUTC || tz === "UTC") {
      const offset = getOffsetMinutes();
      const shifted = new Date(maybeDate.getTime() + offset * 60000);
      const h = shifted.getUTCHours();
      const m = shifted.getUTCMinutes();
      const isPM = h >= 12;
      const h12 = h % 12 || 12;
      const mmStr = m.toString().padStart(2, "0");
      return `${h12}:${mmStr} ${isPM ? "pm" : "am"}`;
    }
    return fmtTZ;
  }
  return input;
}

function toArabicTime(timeStr: string): string {
  // Convert "4:00 pm" to "4:00 مساءً"
  return timeStr
    .replace(/am/gi, "صباحاً")
    .replace(/pm/gi, "مساءً");
}

const HTD_SMS_ID=process.env.HTD_SMS_ID;
const HTD_SMS_SENDER="Lina Nails";
const HTD_SMS_URL=process.env.HTD_SMS_URL;
function cleanPhone(phone: string): string {
  let digits = phone.replace(/[^\d]/g, "");

  if (!digits) return "";

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (!digits.startsWith("972")) {
    digits = `972${digits}`;
  }

  return digits;
}

export async function sendWhatsAppMessage(
  phoneNumber: string,
  clientNameOrMessage: string,
  date?: string,
  time?: string,
  service?: string,
  day?: string,
  lang: string = "en"
): Promise<boolean> {
  try {
    if (!HTD_SMS_ID) {
      console.error("HTD SMS ID missing.");
      return false;
    }
    if(!HTD_SMS_URL){
      console.error("HTD SMS URL missing.");
      return false;
    }
    if(!HTD_SMS_SENDER){
      console.error("HTD SMS Sender missing.");
      return false;
    }

    const phone = cleanPhone(phoneNumber);

    if (!phone) {
      console.error("Invalid phone number:", phoneNumber);
      return false;
    }

    let text: string;

    if (!date) {
      text = clientNameOrMessage;
    } else {
      const timeResolved = toPalestineTime(time!);
      const timeForMessage =
        lang === "ar" ? toArabicTime(timeResolved) : timeResolved;
console.log("Resolved time:", timeResolved, "Message time:", timeForMessage);
console.log("this is test", HTD_SMS_URL, HTD_SMS_ID, HTD_SMS_SENDER, phone, clientNameOrMessage, service, date, timeForMessage);
      text =
        lang === "ar"
         ? `مرحبا ${clientNameOrMessage}، موعدك ${date} الساعة ${timeForMessage}`
         : `Hello ${clientNameOrMessage} 👋\nYour Appointment:${date} - ${timeForMessage}\n`;
    }

    // Keep SMS within 70 characters/words as required by your provider
    if (text.length > 70) {
      console.warn(`SMS is ${text.length} characters.`);
    }

    const params = new URLSearchParams({
      id: HTD_SMS_ID,
      sender: HTD_SMS_SENDER,
      to: phone,
      msg: text,
    });

    const response = await fetch(
      `${HTD_SMS_URL}?${params.toString()}`
    );

    const result = await response.text();

    console.log("HTD SMS response:", result);

    return response.ok;
  } catch (err) {
    console.error("🚨 Failed to send SMS:", err);
    return false;
  }
}

