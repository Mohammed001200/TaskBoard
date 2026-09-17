import { model, Schema } from "mongoose";

const boardSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  teamId: {
    type: Schema.Types.ObjectId,
    ref: "Team",
    required: true,
  },
});

const Board = model("Board", boardSchema);

export default Board;
