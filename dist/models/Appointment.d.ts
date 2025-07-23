import mongoose, { Document } from 'mongoose';
export declare enum AppointmentType {
    Manicure = "MANICURE",
    Pedicure = "PEDICURE",
    Both = "BOTH"
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
export interface BackendAppointment {
    id: string;
    name: string;
    phone: string;
    type: AppointmentType;
    time: string;
    notes?: string;
}
export declare const Appointment: mongoose.Model<IAppointment, {}, {}, {}, mongoose.Document<unknown, {}, IAppointment, {}> & IAppointment & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
