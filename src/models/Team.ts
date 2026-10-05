import { model, Schema } from "mongoose";
import { ITeam } from "../interfaces/models";
const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        // Legacy admin means project owner, never system administrator.
        role: {
          type: String,
          enum: ["owner", "member", "admin"],
          required: true,
        },
      },
    ],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
teamSchema.pre("validate", function () {
  if (!this.ownerId) {
    const owner = this.members.find(
      (member) => member.role === "owner" || member.role === "admin",
    );
    if (owner) this.ownerId = owner.user;
  }
});
teamSchema.path("members").validate(function (members: ITeam["members"]) {
  return (
    new Set(members.map((member) => member.user.toString())).size ===
    members.length
  );
}, "Team members must be unique.");
export default model<ITeam>("Team", teamSchema);
