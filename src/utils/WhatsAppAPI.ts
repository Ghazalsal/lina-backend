import dotenv from "dotenv";
dotenv.config();

export interface WhatsAppConfig {
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
}

const config: WhatsAppConfig = {
  apiVersion: process.env.WHATSAPP_VERSION! || "v22.0",
  phoneNumberId: process.env.WHATSAPP_ID! || "741850909002950",
  accessToken: process.env.WHATSAPP_TOKEN! || "EAAKhhtZApsEcBPPxUIXzlj2mIZAMOTZAHFE6sWU7mYrCdpdZADvM2daqOe9TjvrpN0eVZAZCPHFOkhuhmCGss7ehP16aEFbQgqSQnwBDUX9p6Rt1m2ZB44QLG21zXmlKwoFQsHCbO2B7b56WFB9a5V6WG0cvDYD1LqPh4wcK6VA6lOhQkUCy5UlrraLkmSBEAkJTnx7WVifreEJbZAuvatPSwpaxZBC60ptN6dzRZACYc3MSMOqRVuPh31cOf4ShS3RAZDZD", // <-- Don't forget to update this!
};

export const sendWhatsAppMessage = async (
  phoneNumber: string,
  clientName: string,
  date: string,
  time: string,
  service: string
): Promise<boolean> => {
  const cleanedPhoneNumber = phoneNumber.replace(/[^\d]/g, "");
  const { phoneNumberId, accessToken, apiVersion } = config;

  if (!phoneNumberId || !accessToken || !apiVersion) {
    throw new Error("WhatsApp Business API configuration is missing or invalid.");
  }

  const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const requestBody = {
    messaging_product: "whatsapp",
    to: cleanedPhoneNumber,
    recipient_type: "individual",
    type: "template",
    template: {
      name: "lina_appointment2",
      language: {
        code: "ar", 
      },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: "https://raw.githubusercontent.com/Ghazalsal/image/refs/heads/main/logo-lina.png"
              }
            }
          ]
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: clientName },
            { type: "text", text: date },
            { type: "text", text: time },
            { type: "text", text: service },
          ]
        }
      ]
    }
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Unknown error from WhatsApp API.");
    }
    return true;
  } catch (err) {
    console.error("🚨 Failed to send WhatsApp message:", err);
    return false;
  }
};
