import mongoose, { Schema, Document } from 'mongoose';

export enum AppointmentType {
  Manicure = "MANICURE",
  Pedicure = "PEDICURE",
  Both = "BOTH",
}

export interface IAppointment extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  type: AppointmentType;
  time: Date;
  notes?: string;
  createdAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  type: { type: String, enum: Object.values(AppointmentType), required: true },
  time: { type: Date, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export interface BackendAppointment {
  id: string; // Changed to string to match MongoDB ObjectId
  name: string;
  phone: string;
  type: AppointmentType;
  time: string;
  notes?: string;
}

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);
