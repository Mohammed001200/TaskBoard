import { model, Schema } from "mongoose";
import { IActivity } from "../interfaces/models";
const activitySchema = new Schema<IActivity>({
  action: {
    type: String,
    required: true,
    enum: [
      "created",
      "updated",
      "moved",
      "assigned",
      "unassigned",
      "commented",
      "comment_updated",
      "comment_deleted",
      "deleted",
    ],
  },
  actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  taskId: {
    type: Schema.Types.ObjectId,
    ref: "Task",
    required: true,
    index: true,
  },
  details: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, required: true },
});
export default model<IActivity>("Activity", activitySchema);
