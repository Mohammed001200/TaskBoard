import { model, Schema } from "mongoose";

const columnSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  boardId: {
    type: Schema.Types.ObjectId,
    ref: "Board",
    required: true,
  },
  position: {
    type: Number,
    required: true,
  },
});

const Column = model("Column", columnSchema);

export default Column;
