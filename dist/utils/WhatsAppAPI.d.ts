export interface WhatsAppConfig {
    apiVersion: string;
    phoneNumberId: string;
    accessToken: string;
}
export declare const sendWhatsAppMessage: (phoneNumber: string, clientName: string, date: string, time: string, service: string) => Promise<boolean>;
