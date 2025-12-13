import mongoose, { Schema } from "mongoose";
export var AppointmentType;
(function (AppointmentType) {
    AppointmentType["Manicure"] = "MANICURE";
    AppointmentType["Pedicure"] = "PEDICURE";
    AppointmentType["BothBasic"] = "BOTH_BASIC";
    AppointmentType["BothFull"] = "BOTH_FULL";
    AppointmentType["Eyebrows"] = "EYEBROWS";
    AppointmentType["Lashes"] = "LASHES";
})(AppointmentType || (AppointmentType = {}));
export const ServiceDurations = {
    [AppointmentType.Manicure]: 30,
    [AppointmentType.Pedicure]: 45,
    [AppointmentType.BothBasic]: 60,
    [AppointmentType.BothFull]: 90,
    [AppointmentType.Eyebrows]: 30,
    [AppointmentType.Lashes]: 120,
};
const AppointmentSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: Object.values(AppointmentType), required: true },
    time: { type: Date, required: true },
    endTime: { type: Date, required: true },
    duration: { type: Number, required: true },
    notes: { type: String, default: "" },
    lastReminderSentAt: { type: Date, required: false },
    lastReminderSentForDay: { type: String, required: false },
}, { timestamps: true, versionKey: false });
// Helpful indexes
AppointmentSchema.index({ time: 1 });
AppointmentSchema.index({ userId: 1, time: 1 });
AppointmentSchema.index({ lastReminderSentForDay: 1, time: 1 });
export const Appointment = mongoose.model("Appointment", AppointmentSchema);
