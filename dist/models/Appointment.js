import { JsonDB } from "../utils/JsonDB.js";
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
export const appointmentsDB = new JsonDB("appointments.json");
