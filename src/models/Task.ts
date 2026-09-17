import { model, Schema } from "mongoose";

const taskSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: "",
  },
  columnId: {
    type: Schema.Types.ObjectId,
    ref: "Column",
    required: true,
  },
  assignedUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

const Task = model("Task", taskSchema);

export default Task;
