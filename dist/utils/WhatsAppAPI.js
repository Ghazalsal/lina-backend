import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
function resolveTimezone() {
    const candidates = [
        process.env.DEFAULT_TIMEZONE,
        "Asia/Gaza",
        "Asia/Jerusalem",
        "Europe/Athens",
    ].filter(Boolean);
    for (const tz of candidates) {
        try {
            new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
            return tz;
        }
        catch { }
    }
    return "UTC";
}
function getOffsetMinutes() {
    const raw = (process.env.TZ_OFFSET_MINUTES || "").trim();
    const n = Number(raw);
    if (!isNaN(n) && isFinite(n))
        return n;
    return 120; // default UTC+2
}
function toPalestineTime(input) {
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
    return input;
}
function toArabicTime(timeStr) {
    // Convert "4:00 pm" to "4:00 مساءً"
    return timeStr
        .replace(/am/gi, "صباحاً")
        .replace(/pm/gi, "مساءً");
}
const ULTRAMSG_INSTANCE_ID = String(process.env.ULTRAMSG_INSTANCE_ID);
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_MESSAGES_URL = `https://api.ultramsg.com/instance${ULTRAMSG_INSTANCE_ID}/messages/chat`;
const DEFAULT_COUNTRY_CODE = (process.env.DEFAULT_COUNTRY_CODE || "970").replace(/[^\d]/g, "");
const ULTRAMSG_IMAGE_URL = process.env.ULTRAMSG_IMAGE_URL || "";
function cleanPhone(phone) {
    let raw = phone.trim();
    let digits = raw.replace(/[^\d]/g, "");
    if (!digits)
        return "";
    if (raw.startsWith("+"))
        return "+" + digits;
    if (digits.startsWith(DEFAULT_COUNTRY_CODE) || digits.startsWith("1"))
        return "+" + digits;
    if (digits.startsWith("0"))
        return "+" + DEFAULT_COUNTRY_CODE + digits.slice(1);
    return "+" + DEFAULT_COUNTRY_CODE + digits;
}
export async function sendWhatsAppMessage(phoneNumber, clientNameOrMessage, date, time, service, day, lang = "en") {
    try {
        if (!ULTRAMSG_TOKEN || !ULTRAMSG_INSTANCE_ID) {
            console.error("UltraMsg credentials missing.");
            return false;
        }
        const phone = cleanPhone(phoneNumber);
        if (!phone || phone.length < 11 || !phone.startsWith("+")) {
            throw new Error("Invalid phone number format.");
        }
        let text;
        if (!date) {
            // Raw text message path
            text = clientNameOrMessage;
        }
        else {
            // Formatted reminder path
            const timeResolved = toPalestineTime(time);
            const timeForCaption = lang === "ar" ? toArabicTime(timeResolved) : timeResolved;
            if (!ULTRAMSG_IMAGE_URL) {
                throw new Error("ULTRAMSG_IMAGE_URL missing.");
            }
            const caption = lang === "ar"
                ? `مرحبا ${clientNameOrMessage}\nمنحب نذكرك بموعدك ${service} يوم ${day}\nالساعة ${timeForCaption}\n\nمنستناكي ❤️`
                : `Hello ${clientNameOrMessage}\nReminder for your ${service} on ${day}\nat ${timeForCaption}\n\nWe'll be waiting for you ❤️`;
            return await sendWhatsAppImage(phone, ULTRAMSG_IMAGE_URL, caption);
        }
        const params = new URLSearchParams({ token: ULTRAMSG_TOKEN, to: phone, body: text });
        const response = await fetch(ULTRAMSG_MESSAGES_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });
        return response.ok;
    }
    catch (err) {
        console.error("🚨 Failed to send WhatsApp message:", err);
        return false;
    }
}
export async function sendWhatsAppImage(phoneNumber, imageUrl, caption) {
    try {
        const phone = cleanPhone(phoneNumber);
        const url = `https://api.ultramsg.com/instance${ULTRAMSG_INSTANCE_ID}/messages/image`;
        const params = new URLSearchParams({
            token: ULTRAMSG_TOKEN,
            to: phone,
            image: imageUrl,
            caption: caption || "",
        });
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });
        return response.ok;
    }
    catch (err) {
        console.error("🚨 Failed to send WhatsApp image:", err);
        return false;
    }
}
