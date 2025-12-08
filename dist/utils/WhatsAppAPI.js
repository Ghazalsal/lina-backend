import dotenv from "dotenv";
dotenv.config();
// UltraMsg WhatsApp API configuration
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
export async function sendWhatsAppMessage(...args) {
    try {
        if (!ULTRAMSG_TOKEN || !ULTRAMSG_INSTANCE_ID) {
            console.error("UltraMsg credentials missing. Set ULTRAMSG_TOKEN and ULTRAMSG_INSTANCE_ID in .env.");
            return false;
        }
        const phone = cleanPhone(args[0]);
        if (!phone || phone.length < 11 || !phone.startsWith("+")) {
            throw new Error("Invalid phone number format; must be E.164 starting with '+'.");
        }
        let text;
        if (args.length === 2 && typeof args[1] === "string") {
            // Raw text message path -> keep chat message
            text = args[1];
        }
        else {
            // Formatted reminder path -> send IMAGE ONLY with caption
            const clientName = args[1];
            const date = args[2]; // not used in caption per request
            const time = args[3];
            const service = args[4];
            const day = args[5] || "";
            const lang = args[6] || "en";
            if (!ULTRAMSG_IMAGE_URL) {
                throw new Error("ULTRAMSG_IMAGE_URL missing in environment; set it to your logo/image URL.");
            }
            const caption = lang === "ar"
                ? `مرحبا ${clientName}\nمنحب نذكركم بموعدكم ${service} يوم ${day}\nالساعة ${time}\n\nمنستناكم ❤️`
                : `Hello ${clientName}\nReminder for your ${service} on ${day}\nat ${time}\n\nWe'll be waiting for you ❤️`;
            const imageSent = await sendWhatsAppImage(args[0], ULTRAMSG_IMAGE_URL, caption);
            return imageSent; // Do NOT send chat text for formatted reminders
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
        let responseData;
        if (contentType.includes("application/json")) {
            responseData = await response.json();
        }
        else {
            responseData = await response.text();
        }
        if (!response.ok) {
            console.error("UltraMsg API error:", responseData);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        console.log("WhatsApp message sent successfully via UltraMsg:", responseData);
        return true;
    }
    catch (err) {
        console.error("🚨 Failed to send WhatsApp message via UltraMsg:", err);
        return false;
    }
}
export async function sendWhatsAppImage(phoneNumber, imageUrl, caption) {
    try {
        if (!ULTRAMSG_TOKEN || !ULTRAMSG_INSTANCE_ID) {
            console.error("UltraMsg credentials missing. Set ULTRAMSG_TOKEN and ULTRAMSG_INSTANCE_ID in .env.");
            return false;
        }
        const phone = cleanPhone(phoneNumber);
        if (!phone || !phone.startsWith("+")) {
            throw new Error("Invalid phone number format for image send; must be E.164 with '+'.");
        }
        const url = `https://api.ultramsg.com/instance${ULTRAMSG_INSTANCE_ID}/messages/image`;
        const params = new URLSearchParams({
            token: ULTRAMSG_TOKEN,
            to: phone,
            image: imageUrl,
        });
        if (caption)
            params.append("caption", caption);
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });
        const contentType = resp.headers.get("content-type") || "";
        let data;
        if (contentType.includes("application/json"))
            data = await resp.json();
        else
            data = await resp.text();
        if (!resp.ok) {
            console.error("UltraMsg IMAGE API error:", data);
            return false;
        }
        console.log("WhatsApp image sent successfully via UltraMsg:", data);
        return true;
    }
    catch (err) {
        console.error("🚨 Failed to send WhatsApp image via UltraMsg:", err);
        return false;
    }
}
