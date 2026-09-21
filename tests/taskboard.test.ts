import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Server } from "node:http";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import app from "../src/app";
import * as boardController from "../src/controllers/boardController";
import * as columnController from "../src/controllers/columnController";
import * as taskController from "../src/controllers/taskController";
import * as teamController from "../src/controllers/teamController";
import Board from "../src/models/Board";
import Column from "../src/models/Column";
import Task from "../src/models/Task";
import Team from "../src/models/Team";
import User from "../src/models/User";

const adminId = new Types.ObjectId();
const memberId = new Types.ObjectId();
const outsiderId = new Types.ObjectId();
const teamOneId = new Types.ObjectId();
const teamTwoId = new Types.ObjectId();
const boardOneId = new Types.ObjectId();
const boardTwoId = new Types.ObjectId();
const columnOneId = new Types.ObjectId();
const columnTwoId = new Types.ObjectId();
const taskId = new Types.ObjectId();

process.env.JWT_SECRET = "test-only-secret";

const adminToken = jwt.sign(
  { userId: adminId.toString() },
  process.env.JWT_SECRET,
);

let server: Server;
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not start test server.");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

async function sendRequest(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
) {
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

async function runController(
  controller: Function,
  request: Record<string, unknown>,
) {
  const response = createResponse();
  await controller(request, response);
  return response;
}

function createTeamDocument(
  members: Array<{ user: Types.ObjectId; role: "admin" | "member" }>,
) {
  return {
    _id: teamOneId,
    name: "Team One",
    members,
    save: async () => {},
  };
}

function allowAdminAndMember() {
  (Team.findById as Function) = async () =>
    createTeamDocument([
      { user: adminId, role: "admin" },
      { user: memberId, role: "member" },
    ]);
}

function setTaskRelationship() {
  (Column.findById as Function) = async () => ({
    _id: columnOneId,
    boardId: boardOneId,
  });
  (Board.findById as Function) = async () => ({
    _id: boardOneId,
    teamId: teamOneId,
  });
  allowAdminAndMember();
}

test("health route returns 200", async () => {
  const result = await sendRequest("GET", "/health");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: "ok" });
});

test("invalid registration input returns 400", async () => {
  const result = await sendRequest("POST", "/auth/register", {
    name: "Student",
    email: 123,
    password: "password123",
  });
  assert.equal(result.status, 400);
});

test("registration without a request body returns 400", async () => {
  const result = await sendRequest("POST", "/auth/register");
  assert.equal(result.status, 400);
});

test("invalid login returns 401", async () => {
  (User.findOne as Function) = async () => null;
  const result = await sendRequest("POST", "/auth/login", {
    email: "missing@example.com",
    password: "wrong-password",
  });
  assert.equal(result.status, 401);
});

test("login without a request body returns 400", async () => {
  const result = await sendRequest("POST", "/auth/login");
  assert.equal(result.status, 400);
});

test("protected route without token returns 401", async () => {
  const result = await sendRequest("GET", "/teams");
  assert.equal(result.status, 401);
});

test("JWT with an invalid user id returns 401", async () => {
  const token = jwt.sign({ userId: "not-an-object-id" }, process.env.JWT_SECRET!);
  const result = await sendRequest("GET", "/teams", undefined, token);
  assert.equal(result.status, 401);
});

test("team creator becomes an admin", async () => {
  (Team.create as Function) = async (data: unknown) => ({ _id: teamOneId, ...data as object });
  const result = await runController(teamController.createTeam, {
    body: { name: "Team One" },
    userId: adminId.toString(),
  });

  assert.equal(result.statusCode, 201);
  const team = result.body as { members: Array<{ user: string; role: string }> };
  assert.equal(team.members[0].user, adminId.toString());
  assert.equal(team.members[0].role, "admin");
});

test("duplicate team membership returns 400", async () => {
  (Team.findById as Function) = async () =>
    createTeamDocument([
      { user: adminId, role: "admin" },
      { user: memberId, role: "member" },
    ]);
  (User.findOne as Function) = async () => ({ _id: memberId });

  const result = await runController(teamController.addTeamMember, {
    params: { teamId: teamOneId.toString() },
    body: { email: "member@example.com" },
    userId: adminId.toString(),
  });

  assert.equal(result.statusCode, 400);
});

test("normal member cannot add team members", async () => {
  allowAdminAndMember();
  const result = await runController(teamController.addTeamMember, {
    params: { teamId: teamOneId.toString() },
    body: { email: "other@example.com" },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 403);
});

test("outsider cannot access another team's boards", async () => {
  allowAdminAndMember();
  const result = await runController(boardController.getBoards, {
    params: { teamId: teamOneId.toString() },
    userId: outsiderId.toString(),
  });
  assert.equal(result.statusCode, 403);
});

test("admin can create a board", async () => {
  allowAdminAndMember();
  (Board.create as Function) = async (data: unknown) => ({ _id: boardOneId, ...data as object });

  const result = await runController(boardController.createBoard, {
    params: { teamId: teamOneId.toString() },
    body: { title: "Main Board" },
    userId: adminId.toString(),
  });
  assert.equal(result.statusCode, 201);
});

test("normal member cannot create a board", async () => {
  allowAdminAndMember();
  const result = await runController(boardController.createBoard, {
    params: { teamId: teamOneId.toString() },
    body: { title: "Main Board" },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 403);
});

test("member can list boards", async () => {
  allowAdminAndMember();
  (Board.find as Function) = async () => [{ _id: boardOneId, teamId: teamOneId }];

  const result = await runController(boardController.getBoards, {
    params: { teamId: teamOneId.toString() },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 200);
});

test("admin can create a column", async () => {
  (Board.findById as Function) = async () => ({ _id: boardOneId, teamId: teamOneId });
  allowAdminAndMember();
  (Column.create as Function) = async (data: unknown) => ({ _id: columnOneId, ...data as object });

  const result = await runController(columnController.createColumn, {
    params: { boardId: boardOneId.toString() },
    body: { title: "Todo", position: 1 },
    userId: adminId.toString(),
  });
  assert.equal(result.statusCode, 201);
});

test("normal member cannot create a column", async () => {
  (Board.findById as Function) = async () => ({ _id: boardOneId, teamId: teamOneId });
  allowAdminAndMember();

  const result = await runController(columnController.createColumn, {
    params: { boardId: boardOneId.toString() },
    body: { title: "Todo", position: 1 },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 403);
});

test("columns are returned in position order", async () => {
  (Board.findById as Function) = async () => ({ _id: boardOneId, teamId: teamOneId });
  allowAdminAndMember();
  (Column.find as Function) = () => ({
    sort: async (order: { position: number }) => {
      assert.deepEqual(order, { position: 1 });
      return [
        { title: "Todo", position: 1 },
        { title: "In Progress", position: 2 },
        { title: "Done", position: 3 },
      ];
    },
  });

  const result = await runController(columnController.getColumns, {
    params: { boardId: boardOneId.toString() },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(
    (result.body as Array<{ position: number }>).map((column) => column.position),
    [1, 2, 3],
  );
});

test("member can create a task", async () => {
  setTaskRelationship();
  (Task.create as Function) = async (data: unknown) => ({ _id: taskId, ...data as object });

  const result = await runController(taskController.createTask, {
    params: { columnId: columnOneId.toString() },
    body: { title: "Test task" },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 201);
});

test("member can list tasks", async () => {
  setTaskRelationship();
  (Task.find as Function) = async () => [{ _id: taskId, columnId: columnOneId }];

  const result = await runController(taskController.getTasks, {
    params: { columnId: columnOneId.toString() },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 200);
});

test("member can update a task", async () => {
  setTaskRelationship();
  const task = {
    _id: taskId,
    title: "Old title",
    description: "",
    assignedUserId: null,
    columnId: columnOneId,
    save: async () => {},
  };
  (Task.findById as Function) = async () => task;

  const result = await runController(taskController.updateTask, {
    params: { taskId: taskId.toString() },
    body: { title: "New title" },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 200);
  assert.equal(task.title, "New title");
});

test("outsider cannot access a task", async () => {
  setTaskRelationship();
  (Task.findById as Function) = async () => ({ _id: taskId, columnId: columnOneId });

  const result = await runController(taskController.getTask, {
    params: { taskId: taskId.toString() },
    userId: outsiderId.toString(),
  });
  assert.equal(result.statusCode, 403);
});

test("wrong-team task assignment is rejected", async () => {
  setTaskRelationship();
  (User.findById as Function) = async () => ({ _id: outsiderId });

  const result = await runController(taskController.createTask, {
    params: { columnId: columnOneId.toString() },
    body: {
      title: "Test task",
      assignedUserId: outsiderId.toString(),
    },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 400);
});

test("normal member cannot delete a task", async () => {
  setTaskRelationship();
  (Task.findById as Function) = async () => ({
    _id: taskId,
    columnId: columnOneId,
    deleteOne: async () => {},
  });

  const result = await runController(taskController.deleteTask, {
    params: { taskId: taskId.toString() },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 403);
});

test("admin can delete a task", async () => {
  setTaskRelationship();
  let deleted = false;
  (Task.findById as Function) = async () => ({
    _id: taskId,
    columnId: columnOneId,
    deleteOne: async () => {
      deleted = true;
    },
  });

  const result = await runController(taskController.deleteTask, {
    params: { taskId: taskId.toString() },
    userId: adminId.toString(),
  });
  assert.equal(result.statusCode, 200);
  assert.equal(deleted, true);
});

function setMoveRelationships(crossTeam: boolean) {
  const task = {
    _id: taskId,
    columnId: columnOneId,
    save: async () => {},
  };
  (Task.findById as Function) = async () => task;
  (Column.findById as Function) = async (id: Types.ObjectId | string) =>
    id.toString() === columnOneId.toString()
      ? { _id: columnOneId, boardId: boardOneId }
      : { _id: columnTwoId, boardId: boardTwoId };
  (Board.findById as Function) = async (id: Types.ObjectId | string) =>
    id.toString() === boardOneId.toString()
      ? { _id: boardOneId, teamId: teamOneId }
      : { _id: boardTwoId, teamId: crossTeam ? teamTwoId : teamOneId };
  allowAdminAndMember();
  return task;
}

test("member can move a task within the same team", async () => {
  const task = setMoveRelationships(false);
  const result = await runController(taskController.moveTask, {
    params: { taskId: taskId.toString() },
    body: { columnId: columnTwoId.toString() },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 200);
  assert.equal(task.columnId.toString(), columnTwoId.toString());
});

test("cross-team task move returns 403", async () => {
  setMoveRelationships(true);
  const result = await runController(taskController.moveTask, {
    params: { taskId: taskId.toString() },
    body: { columnId: columnTwoId.toString() },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 403);
});

test("malformed destination column id returns 400", async () => {
  const result = await sendRequest(
    "PATCH",
    `/tasks/${taskId}/move`,
    { columnId: "not-an-object-id" },
    adminToken,
  );
  assert.equal(result.status, 400);
});

test("nonexistent destination column returns 404", async () => {
  const task = {
    _id: taskId,
    columnId: columnOneId,
    save: async () => {},
  };
  (Task.findById as Function) = async () => task;
  (Column.findById as Function) = async (id: Types.ObjectId | string) =>
    id.toString() === columnOneId.toString()
      ? { _id: columnOneId, boardId: boardOneId }
      : null;
  (Board.findById as Function) = async () => ({ _id: boardOneId, teamId: teamOneId });
  allowAdminAndMember();

  const result = await runController(taskController.moveTask, {
    params: { taskId: taskId.toString() },
    body: { columnId: columnTwoId.toString() },
    userId: memberId.toString(),
  });
  assert.equal(result.statusCode, 404);
});

test("malformed path ObjectId returns 404 instead of 500", async () => {
  const result = await sendRequest("GET", "/tasks/not-an-object-id", undefined, adminToken);
  assert.equal(result.status, 404);
});

test("missing request body returns 400", async () => {
  const result = await sendRequest("POST", "/teams", undefined, adminToken);
  assert.equal(result.status, 400);
});

test("all protected route groups reject unauthenticated requests", async () => {
  const requests: Array<[string, string]> = [
    ["GET", "/teams"],
    ["GET", `/teams/${teamOneId}/boards`],
    ["GET", `/boards/${boardOneId}/columns`],
    ["GET", `/columns/${columnOneId}/tasks`],
    ["GET", `/tasks/${taskId}`],
  ];

  for (const [method, path] of requests) {
    const result = await sendRequest(method, path);
    assert.equal(result.status, 401);
  }
});

test("nonexistent task returns 404", async () => {
  (Task.findById as Function) = async () => null;
  const result = await sendRequest("GET", `/tasks/${taskId}`, undefined, adminToken);
  assert.equal(result.status, 404);
});
