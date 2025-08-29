import dotenv from "dotenv";
dotenv.config();

export interface WhatsAppConfig {
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
}

const config: WhatsAppConfig = {
  apiVersion: process.env.WHATSAPP_VERSION || "v22.0", // UpdatesendWhatsAppMessaged to a more recent version
  phoneNumberId: process.env.WHATSAPP_ID || "741850909002950",
  accessToken:
    process.env.WHATSAPP_TOKEN ||
    "EAAKhhtZApsEcBPWea8Ludua4y9zgdkBSsTD4vZCsMMZA2l1ctSsYMcp8aAjkjOQu60dX978wIO6l9YOD5M5TjqGamtO5FLVpzVGEoYdQLZAZAlIoGAVIFazmOpTBZCUFo0cI9KHKVsCytohZAwRdZC5mPLuet8Aqnn8YJ2RebStxlAQDexidnZBZCYJwcXsYMuBShUfjCttiKzQADE4kKjpC9vb2QzI1oZA2HxtlgUJmS4WXZCXBpsZC5F8v0bZAQzw5s6zAZDZD",
};

export const sendWhatsAppMessage = async (
  phoneNumber: string,
  clientName: string,
  date: string,
  time: string,
  service: string,
  lang: string = "en"
): Promise<boolean> => {
  try {
    const cleanedPhoneNumber = phoneNumber.replace(/[^\d]/g, "");
    const { phoneNumberId, accessToken, apiVersion } = config;

    // Validate phone number
    if (!cleanedPhoneNumber || cleanedPhoneNumber.length < 10) {
      throw new Error("Invalid phone number");
    }

    const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    // Use different templates based on language

    const body = {
      messaging_product: "whatsapp",
      to: cleanedPhoneNumber,
      recipient_type: "individual",
      type: "template",
      template: {
        name: "lina_appointment2",
        language: { code: "ar" },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "image",
                image: {
                  link: "https://raw.githubusercontent.com/Ghazalsal/image/refs/heads/main/logo-lina.png",
                },
              },
            ],
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: clientName },
              { type: "text", text: date },
              { type: "text", text: time },
              { type: "text", text: service },
            ],
          },
        ],
      },
    };

    console.log("Sending WhatsApp message to:", cleanedPhoneNumber);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API error:", responseData);
      throw new Error(
        responseData.error?.message ||
          `HTTP ${response.status}: ${response.statusText}`
      );
    }

    console.log("WhatsApp message sent successfully:", responseData);
    return true;
  } catch (err) {
    console.error("🚨 Failed to send WhatsApp message:", err);
    return false;
  }
};
