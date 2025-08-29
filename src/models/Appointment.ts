import mongoose, { Schema, Document, Types } from "mongoose";
import type { IUser } from "./User.js";

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

export interface IAppointment extends Document {
  _id: Types.ObjectId;
  userId: IUser | Types.ObjectId; // populated or ObjectId
  type: AppointmentType;
  time: Date;
  endTime: Date;
  duration: number;
  notes?: string;
}

const AppointmentSchema: Schema<IAppointment> = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: Object.values(AppointmentType), required: true },
    time: { type: Date, required: true },
    endTime: { type: Date, required: true },
    duration: { type: Number, required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

// Helpful indexes
AppointmentSchema.index({ time: 1 });
AppointmentSchema.index({ userId: 1, time: 1 });

export const Appointment = mongoose.model<IAppointment>("Appointment", AppointmentSchema);
