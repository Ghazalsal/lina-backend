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
  // If input looks like an ISO date, convert; otherwise assume it is already formatted time.
  const maybeDate = new Date(input);
  if (!isNaN(maybeDate.getTime())) {
    const tz = resolveTimezone();
    const fmtTZ = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    }).format(maybeDate);
    const fmtUTC = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }).format(maybeDate);

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
  // Already formatted string like "4:00 pm"; return as-is
  return input;
}

// UltraMsg WhatsApp API configuration
const ULTRAMSG_INSTANCE_ID = String(process.env.ULTRAMSG_INSTANCE_ID);
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_MESSAGES_URL = `https://api.ultramsg.com/instance${ULTRAMSG_INSTANCE_ID}/messages/chat`;
const DEFAULT_COUNTRY_CODE = (process.env.DEFAULT_COUNTRY_CODE || "970").replace(/[^\d]/g, "");
const ULTRAMSG_IMAGE_URL = process.env.ULTRAMSG_IMAGE_URL || "";

function cleanPhone(phone: string): string {
  let raw = phone.trim();
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";

  // If original contains a '+', assume it's already E.164; rebuild with '+' and digits only
  if (raw.startsWith("+")) {
    return "+" + digits;
  }

  // If number already starts with a country code like DEFAULT_COUNTRY_CODE or '1', add '+'
  if (digits.startsWith(DEFAULT_COUNTRY_CODE) || digits.startsWith("1")) {
    return "+" + digits;
  }

  // If local-style number starting with 0, convert to '+' + country code + rest
  if (digits.startsWith("0")) {
    return "+" + DEFAULT_COUNTRY_CODE + digits.slice(1);
  }

  // Otherwise, assume it's missing country code; prefix default country code
  return "+" + DEFAULT_COUNTRY_CODE + digits;
}

// Overloads: support sending a raw text message OR a formatted appointment reminder
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<boolean>;
export async function sendWhatsAppMessage(
  phoneNumber: string,
  clientName: string,
  date: string,
  time: string,
  service: string,
  day: string,
  lang?: string
): Promise<boolean>;
export async function sendWhatsAppMessage(...args: any[]): Promise<boolean> {
  try {
    if (!ULTRAMSG_TOKEN || !ULTRAMSG_INSTANCE_ID) {
      console.error("UltraMsg credentials missing. Set ULTRAMSG_TOKEN and ULTRAMSG_INSTANCE_ID in .env.");
      return false;
    }

    const phone = cleanPhone(args[0] as string);
    if (!phone || phone.length < 11 || !phone.startsWith("+")) {
      throw new Error("Invalid phone number format; must be E.164 starting with '+'.");
    }

    let text: string;

    if (args.length === 2 && typeof args[1] === "string") {
      // Raw text message path -> keep chat message
      text = args[1] as string;
    } else {
      // Formatted reminder path -> send IMAGE ONLY with caption
      const clientName = args[1] as string;
      const date = args[2] as string; // not used in caption per request
      const rawTime = args[3] as string;
      const service = args[4] as string;
      const day = (args[5] as string) || "";
      const lang = (args[6] as string) || "en";
      const timeResolved = toPalestineTime(rawTime);
      const timeForCaption = lang === "ar" ? toArabicTime(timeResolved) : timeResolved;

      if (!ULTRAMSG_IMAGE_URL) {
        throw new Error("ULTRAMSG_IMAGE_URL missing in environment; set it to your logo/image URL.");
      }

      const caption =
        lang === "ar"
          ? `مرحبا ${clientName}\nمنحب نذكركم بموعدكم ${service} يوم ${day}\nالساعة ${timeForCaption}\n\nمنستناكم ❤️`
          : `Hello ${clientName}\nReminder for your ${service} on ${day}\nat ${timeForCaption}\n\nWe'll be waiting for you ❤️`;

      const imageSent = await sendWhatsAppImage(args[0] as string, ULTRAMSG_IMAGE_URL, caption);
      return imageSent;
    }

    console.log("Sending WhatsApp message via UltraMsg to:", phone);

    // x-www-form-urlencoded payload (raw chat message only)
    const params = new URLSearchParams({ token: ULTRAMSG_TOKEN, to: phone, body: text });

    const response = await fetch(ULTRAMSG_MESSAGES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const contentType = response.headers.get("content-type") || "";
    let responseData: any;
    if (contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      console.error("UltraMsg API error:", responseData);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log("WhatsApp message sent successfully via UltraMsg:", responseData);
    return true;
  } catch (err) {
    console.error("🚨 Failed to send WhatsApp message via UltraMsg:", err);
    return false;
  }
}

export async function sendWhatsAppImage(
  phoneNumber: string,
  imageUrl: string,
  caption?: string
): Promise<boolean> {
  try {
    if (!ULTRAMSG_TOKEN || !ULTRAMSG_INSTANCE_ID) {
      console.error(
        "UltraMsg credentials missing. Set ULTRAMSG_TOKEN and ULTRAMSG_INSTANCE_ID in .env."
      );
      return false;
    }
    const phone = cleanPhone(phoneNumber);
    if (!phone || !phone.startsWith("+")) {
      throw new Error(
        "Invalid phone number format for image send; must be E.164 with '+'."
      );
    }

    const url = `https://api.ultramsg.com/instance${ULTRAMSG_INSTANCE_ID}/messages/image`;
    const params = new URLSearchParams({
      token: ULTRAMSG_TOKEN,
      to: phone,
      image: imageUrl,
    });
    if (caption) params.append("caption", caption);

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const contentType = resp.headers.get("content-type") || "";
    let data: any;
    if (contentType.includes("application/json")) data = await resp.json();
    else data = await resp.text();

    if (!resp.ok) {
      console.error("UltraMsg IMAGE API error:", data);
      return false;
    }
    console.log("WhatsApp image sent successfully via UltraMsg:", data);
    return true;
  } catch (err) {
    console.error("🚨 Failed to send WhatsApp image via UltraMsg:", err);
    return false;
  }
}

// Convert Western digits to Arabic-Indic digits and AM/PM to Arabic markers
function toArabicDigits(str: string): string {
  const map: Record<string, string> = {
    "0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
    "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩",
  };
  return str.replace(/[0-9]/g, (d) => map[d] || d);
}

function toArabicTime(str: string): string {
  const trimmed = str.trim();
  const lower = trimmed.toLowerCase();
  let suffix = "";
  if (/[\u0635]/.test(trimmed) || /\bص\b/.test(trimmed)) {
    suffix = "ص"; // already Arabic AM
  } else if (/[\u0645]/.test(trimmed) || /\bم\b/.test(trimmed)) {
    suffix = "م"; // already Arabic PM
  } else if (lower.includes("am")) {
    suffix = "ص";
  } else if (lower.includes("pm")) {
    suffix = "م";
  }
  // strip any English/Arabic am/pm markers
  const baseNoMarker = trimmed
    .replace(/\s*(am|pm)\s*/i, "")
    .replace(/\s*(ص|م)\s*/g, "")
    .trim();

  // normalize 12-hour display: if hour is 00, treat as 12
  let normalized = baseNoMarker;
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    let h = parseInt(match[1], 10);
    const mm = match[2];
    if (isNaN(h) || h === 0) h = 12; // 00 -> 12
    normalized = `${String(h).padStart(2, "0")}:${mm}`;
  }

  const arabicDigits = toArabicDigits(normalized);
  return suffix ? `${arabicDigits} ${suffix}` : arabicDigits;
}
