import { model, Schema } from "mongoose";
import { IColumn } from "../interfaces/models";
const columnSchema = new Schema<IColumn>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    position: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    allowedTransitions: {
      type: [{ type: Schema.Types.ObjectId, ref: "Column" }],
      default: null,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export default model<IColumn>("Column", columnSchema);
