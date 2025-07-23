import mongoose, { Schema } from 'mongoose';
export var AppointmentType;
(function (AppointmentType) {
    AppointmentType["Manicure"] = "MANICURE";
    AppointmentType["Pedicure"] = "PEDICURE";
    AppointmentType["Both"] = "BOTH";
})(AppointmentType || (AppointmentType = {}));
const AppointmentSchema = new Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    type: { type: String, enum: Object.values(AppointmentType), required: true },
    time: { type: Date, required: true },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now },
});
export const Appointment = mongoose.model('Appointment', AppointmentSchema);
