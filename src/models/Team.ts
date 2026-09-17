import { model, Schema } from "mongoose";

const teamSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  members: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      role: {
        type: String,
        enum: ["admin", "member"],
        required: true,
      },
    },
  ],
});

const Team = model("Team", teamSchema);

export default Team;
