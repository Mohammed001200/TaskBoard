import { model, Schema } from "mongoose";
import { IBoard } from "../interfaces/models";
const boardSchema = new Schema<IBoard>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export default model<IBoard>("Board", boardSchema);
