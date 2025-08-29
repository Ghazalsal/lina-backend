import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  appointments: Types.ObjectId[];
}

const UserSchema: Schema<IUser> = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    appointments: [{ type: Schema.Types.ObjectId, ref: "Appointment" }],
  },
  { timestamps: true, versionKey: false }
);

UserSchema.index({ phone: 1 }, { unique: true });

export const User = mongoose.model<IUser>("User", UserSchema);
