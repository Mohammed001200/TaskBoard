import { model, Schema } from "mongoose";
import { IUser } from "../interfaces/models";
const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: { type: String, required: true, select: false },
    isAdmin: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, result) => {
        Reflect.deleteProperty(result, "password");
        Reflect.deleteProperty(result, "__v");
        return result;
      },
    },
  },
);
export default model<IUser>("User", userSchema);
