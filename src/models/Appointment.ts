import { JsonDB } from "../utils/JsonDB.js";

export enum AppointmentType {
  Manicure = "MANICURE",
  Pedicure = "PEDICURE",
  BothBasic = "BOTH_BASIC",
  BothFull = "BOTH_FULL",
  Eyebrows = "EYEBROWS",
  Lashes = "LASHES",
}

export const ServiceDurations: Record<AppointmentType, number> = {
  [AppointmentType.Manicure]: 30,
  [AppointmentType.Pedicure]: 45,
  [AppointmentType.BothBasic]: 60,
  [AppointmentType.BothFull]: 90,
  [AppointmentType.Eyebrows]: 30,
  [AppointmentType.Lashes]: 120,
};

export interface Appointment {
  id: string;
  userId: string;
  type: AppointmentType;
  time: string; // ISO String
  endTime: string; // ISO String
  duration: number;
  notes?: string;
  lastReminderSentAt?: string;
  lastReminderSentForDay?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const appointmentsDB = new JsonDB<Appointment>("appointments.json");
