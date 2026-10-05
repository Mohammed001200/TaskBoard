import { Types } from "mongoose";
export interface IUser {
  name: string;
  email: string;
  password: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
export interface ITeam {
  name: string;
  ownerId: Types.ObjectId;
  members: { user: Types.ObjectId; role: "owner" | "member" | "admin" }[];
  deletedAt: Date | null;
}
export interface IBoard {
  title: string;
  teamId: Types.ObjectId;
  deletedAt: Date | null;
}
export interface IColumn {
  title: string;
  boardId: Types.ObjectId;
  position: number;
  allowedTransitions: Types.ObjectId[] | null;
  deletedAt: Date | null;
}
export interface ITask {
  title: string;
  description: string;
  deadline: Date | null;
  priority: "low" | "medium" | "high";
  columnId: Types.ObjectId;
  assignedUserId: Types.ObjectId | null;
  deletedAt: Date | null;
}
export interface IComment {
  text: string;
  authorId: Types.ObjectId | null;
  taskId: Types.ObjectId;
  deletedAt: Date | null;
}
export type ActivityAction =
  | "created"
  | "updated"
  | "moved"
  | "assigned"
  | "unassigned"
  | "commented"
  | "comment_updated"
  | "comment_deleted"
  | "deleted";
export interface IActivity {
  action: ActivityAction;
  actorId: Types.ObjectId | null;
  taskId: Types.ObjectId;
  details: Record<string, unknown>;
  createdAt: Date;
}
