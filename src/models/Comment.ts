import { model, Schema } from "mongoose";
import { IComment } from "../interfaces/models";
const commentSchema = new Schema<IComment>(
  {
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export default model<IComment>("Comment", commentSchema);
