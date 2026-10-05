import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request, { Test } from "supertest";
import app from "../src/app";
import Activity from "../src/models/Activity";
import Board from "../src/models/Board";
import Column from "../src/models/Column";
import Comment from "../src/models/Comment";
import Task from "../src/models/Task";
import Team from "../src/models/Team";
import User from "../src/models/User";

interface Person {
  id: string;
  email: string;
  token: string;
}

interface Workspace {
  teamId: string;
  boardId: string;
  todo: string;
  progress: string;
  done: string;
}

type Method = "get" | "post" | "patch" | "delete";
const password = "Strong-test-password-123";
const databaseName = `taskboard_test_${process.pid}`;
let mongo: MongoMemoryReplSet;
let passwordHash: string;
let owner: Person;
let member: Person;
let outsider: Person;
let admin: Person;
let workspace: Workspace;

function api(
  method: Method,
  path: string,
  person?: Person,
  body?: object,
): Test {
  const call = request(app)[method](path);
  if (person) call.set("Authorization", `Bearer ${person.token}`);
  if (body !== undefined) call.send(body);
  return call;
}

async function person(name: string, isAdmin = false): Promise<Person> {
  const email = `${name.toLowerCase()}@example.test`;
  const user = await User.create({
    name,
    email,
    password: passwordHash,
    isAdmin,
  });
  return {
    id: user._id.toString(),
    email,
    token: jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    }),
  };
}

async function createWorkspace(
  creator: Person,
  teammate?: Person,
): Promise<Workspace> {
  const team = await api("post", "/teams", creator, {
    name: "Integration team",
  }).expect(201);
  if (teammate) {
    await api("post", `/teams/${team.body._id}/members`, creator, {
      email: teammate.email,
    }).expect(201);
  }
  const board = await api("post", `/teams/${team.body._id}/boards`, creator, {
    title: "Project board",
  }).expect(201);
  const columnIds: string[] = [];
  for (const [index, title] of ["Todo", "In Progress", "Done"].entries()) {
    const column = await api(
      "post",
      `/boards/${board.body._id}/columns`,
      creator,
      {
        title,
        position: index + 1,
      },
    ).expect(201);
    columnIds.push(column.body._id);
  }
  return {
    teamId: team.body._id,
    boardId: board.body._id,
    todo: columnIds[0],
    progress: columnIds[1],
    done: columnIds[2],
  };
}

async function createTask(actor: Person = member, body: object = {}) {
  return (
    await api("post", `/columns/${workspace.todo}/tasks`, actor, {
      title: "Prepare presentation",
      description: "A real persisted task",
      ...body,
    }).expect(201)
  ).body;
}

beforeAll(async () => {
  // A real isolated replica set allows transaction tests, without Atlas credentials.
  mongo = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  process.env.MONGODB_URI = mongo.getUri(databaseName);
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(
    [User, Team, Board, Column, Task, Comment, Activity].map((model) =>
      model.init(),
    ),
  );
  passwordHash = await bcrypt.hash(password, 10);
});

beforeEach(async () => {
  if (mongoose.connection.name !== databaseName) {
    throw new Error(
      "Refusing to clear any database except this isolated test database.",
    );
  }
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
  [owner, member, outsider, admin] = await Promise.all([
    person("Owner"),
    person("Member"),
    person("Outsider"),
    person("Support", true),
  ]);
  workspace = await createWorkspace(owner, member);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe("health and real authentication", () => {
  test("GET /health returns status ok", async () => {
    const response = await api("get", "/health").expect(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  test("register, bcrypt hash, created date, and login produce a valid JWT", async () => {
    const email = "new-user@example.test";
    await api("post", "/auth/register", undefined, {
      name: "New user",
      email,
      password,
    }).expect(201);
    const stored = await User.findOne({ email }).select("+password");
    expect(stored).not.toBeNull();
    expect(stored!.password).not.toBe(password);
    expect(await bcrypt.compare(password, stored!.password)).toBe(true);
    expect(stored!.createdAt).toBeInstanceOf(Date);
    expect(stored!.isAdmin).toBe(false);
    const login = await api("post", "/auth/login", undefined, {
      email,
      password,
    }).expect(200);
    const payload = jwt.verify(
      login.body.token,
      process.env.JWT_SECRET!,
    ) as jwt.JwtPayload;
    expect(payload.userId).toBe(stored!._id.toString());
    expect(payload.exp! - payload.iat!).toBe(3600);
    expect(login.body.password).toBeUndefined();
    await api("get", "/users/me", {
      id: stored!._id.toString(),
      email,
      token: login.body.token,
    }).expect(200);
  });

  test("duplicate email is a conflict and bad credentials are rejected", async () => {
    await api("post", "/auth/register", undefined, {
      name: "Duplicate",
      email: member.email,
      password,
    }).expect(409);
    await api("post", "/auth/login", undefined, {
      email: member.email,
      password: "wrong-password",
    }).expect(401);
  });

  test("registration cannot grant global administration", async () => {
    await api("post", "/auth/register", undefined, {
      name: "Escalation",
      email: "escalation@example.test",
      password,
      isAdmin: true,
    }).expect(400);
    expect(await User.findOne({ email: "escalation@example.test" })).toBeNull();
  });

  test.each([
    ["get", "/users/me"],
    ["get", "/users"],
    ["post", "/teams"],
    ["get", "/teams"],
    ["get", "/teams/id"],
    ["patch", "/teams/id"],
    ["delete", "/teams/id"],
    ["post", "/teams/id/members"],
    ["delete", "/teams/id/members/id"],
    ["post", "/teams/id/boards"],
    ["get", "/teams/id/boards"],
    ["get", "/boards/id"],
    ["patch", "/boards/id"],
    ["delete", "/boards/id"],
    ["post", "/boards/id/columns"],
    ["get", "/boards/id/columns"],
    ["get", "/columns/id"],
    ["patch", "/columns/id"],
    ["delete", "/columns/id"],
    ["post", "/columns/id/tasks"],
    ["get", "/columns/id/tasks"],
    ["get", "/tasks/id"],
    ["patch", "/tasks/id"],
    ["delete", "/tasks/id"],
    ["patch", "/tasks/id/move"],
    ["post", "/tasks/id/comments"],
    ["get", "/tasks/id/comments"],
    ["get", "/tasks/id/activities"],
    ["get", "/comments/id"],
    ["patch", "/comments/id"],
    ["delete", "/comments/id"],
    ["patch", "/users/me"],
    ["delete", "/users/me"],
  ] as [Method, string][])(
    "%s %s requires authentication",
    async (method, path) => {
      const validId = new Types.ObjectId().toString();
      const validPath = path.replace(/\/id(?=\/|$)/g, `/${validId}`);
      let body: object | undefined;
      if (method === "post" || method === "patch") {
        if (path.includes("/members")) body = { email: outsider.email };
        else if (path.includes("/comments")) body = { text: "Valid comment" };
        else if (path.endsWith("/move")) body = { columnId: validId };
        else if (
          path === "/teams" ||
          path === "/teams/id" ||
          path === "/users/me"
        )
          body = { name: "Valid name" };
        else if (path.endsWith("/columns"))
          body = { title: "Valid column", position: 4 };
        else body = { title: "Valid title" };
      }
      await api(method, validPath, undefined, body).expect(401);
    },
  );

  test("invalid, expired, and malformed-identity JWTs are rejected", async () => {
    for (const token of [
      "not-a-token",
      jwt.sign({ userId: owner.id }, "wrong-key"),
      jwt.sign({ userId: owner.id }, process.env.JWT_SECRET!, {
        expiresIn: -1,
      }),
      jwt.sign({ userId: "bad-id" }, process.env.JWT_SECRET!),
    ]) {
      await request(app)
        .get("/teams")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    }
  });

  test("admin permission comes from the current user, not a stale JWT", async () => {
    await api("get", "/users", admin).expect(200);
    await User.findByIdAndUpdate(admin.id, { isAdmin: false });
    await api("get", "/users", admin).expect(403);
    await User.findByIdAndUpdate(member.id, { isAdmin: true });
    await api("get", "/users", member).expect(200);
  });
});

describe("users", () => {
  test("read and update the current user without leaking or accepting sensitive fields", async () => {
    const me = await api("get", "/users/me", member).expect(200);
    expect(me.body._id).toBe(member.id);
    expect(me.body.password).toBeUndefined();
    expect(me.body.createdAt).toBeDefined();
    const updated = await api("patch", "/users/me", member, {
      name: "Updated member",
    }).expect(200);
    expect(updated.body.name).toBe("Updated member");
    expect(updated.body.password).toBeUndefined();
    await api("patch", "/users/me", member, { isAdmin: true }).expect(400);
    await api("get", "/users", member).expect(403);
    const all = await api("get", "/users", admin).expect(200);
    expect(
      all.body.some((user: { _id: string }) => user._id === owner.id),
    ).toBe(true);
    expect(
      all.body.every(
        (user: { password?: string }) => user.password === undefined,
      ),
    ).toBe(true);
  });

  test("an owner must resolve owned teams before deleting their account", async () => {
    await api("delete", "/users/me", owner).expect(409);
    await api("get", "/users/me", owner).expect(200);
  });

  test("profile email/password changes persist and the new bcrypt password authenticates", async () => {
    const newEmail = "renamed-member@example.test";
    const newPassword = "Different-strong-password-456";
    const changed = await api("patch", "/users/me", member, {
      email: newEmail,
      password: newPassword,
    }).expect(200);
    expect(changed.body.email).toBe(newEmail);
    expect(changed.body.password).toBeUndefined();
    const stored = await User.findById(member.id).select("+password");
    expect(await bcrypt.compare(newPassword, stored!.password)).toBe(true);
    await api("post", "/auth/login", undefined, {
      email: newEmail,
      password: newPassword,
    }).expect(200);
    await api("post", "/auth/login", undefined, {
      email: newEmail,
      password,
    }).expect(401);
    await api("patch", "/users/me", member, { email: owner.email }).expect(409);
  });

  test("account deletion anonymizes retained history and invalidates existing JWTs", async () => {
    // An attacker cannot reserve the predictable legacy tombstone and block deletion.
    await api("patch", "/users/me", outsider, {
      email: `deleted-${member.id}@example.invalid`,
    }).expect(200);
    const task = await createTask(member, { assignedUserId: member.id });
    const comment = await api("post", `/tasks/${task._id}/comments`, member, {
      text: "Private author text",
    }).expect(201);
    const beforeCount = await Activity.countDocuments({ taskId: task._id });
    await api("delete", "/users/me", member).expect(200);
    await api("get", "/users/me", member).expect(401);
    await api("post", "/auth/login", undefined, {
      email: member.email,
      password,
    }).expect(401);
    const retained = await User.findById(member.id).select("+password");
    expect(retained!.deletedAt).toBeInstanceOf(Date);
    expect(retained!.email).not.toBe(member.email);
    expect(retained!.email).not.toBe(`deleted-${member.id}@example.invalid`);
    expect(retained!.password).not.toBe(passwordHash);
    expect((await Task.findById(task._id))!.assignedUserId).toBeNull();
    const preservedComment = await Comment.findById(comment.body._id);
    expect(preservedComment!.authorId).toBeNull();
    expect(preservedComment!.text).toBe("[deleted]");
    const activities = await Activity.find({ taskId: task._id });
    expect(activities.length).toBeGreaterThanOrEqual(beforeCount);
    expect(activities.every((activity) => activity.actorId === null)).toBe(
      true,
    );
    const team = await Team.findById(workspace.teamId);
    expect(
      team!.members.some((entry) => entry.user.toString() === member.id),
    ).toBe(false);
  });
});

describe("teams and membership", () => {
  test("create, list, read, rename, and soft-delete a team", async () => {
    const team = await api("get", `/teams/${workspace.teamId}`, member).expect(
      200,
    );
    expect(team.body.ownerId).toBe(owner.id);
    expect(
      team.body.members.map((entry: { role: string }) => entry.role).sort(),
    ).toEqual(["member", "owner"]);
    const listed = await api("get", "/teams", member).expect(200);
    expect(listed.body.map((entry: { _id: string }) => entry._id)).toContain(
      workspace.teamId,
    );
    const updated = await api("patch", `/teams/${workspace.teamId}`, owner, {
      name: "Renamed team",
    }).expect(200);
    expect(updated.body.name).toBe("Renamed team");
    await api("delete", `/teams/${workspace.teamId}`, owner).expect(200);
    await api("get", `/teams/${workspace.teamId}`, owner).expect(404);
    const after = await api("get", "/teams", owner).expect(200);
    expect(after.body.map((entry: { _id: string }) => entry._id)).not.toContain(
      workspace.teamId,
    );
    expect((await Team.findById(workspace.teamId))!.deletedAt).toBeInstanceOf(
      Date,
    );
    await api("get", `/boards/${workspace.boardId}`, owner).expect(404);
  });

  test("owner adds and removes members; their task history survives removal", async () => {
    await api("post", `/teams/${workspace.teamId}/members`, owner, {
      email: outsider.email,
    }).expect(201);
    await api("get", `/teams/${workspace.teamId}`, outsider).expect(200);
    const task = await createTask(outsider);
    const activitiesBefore = await Activity.countDocuments({
      taskId: task._id,
    });
    await api(
      "delete",
      `/teams/${workspace.teamId}/members/${outsider.id}`,
      owner,
    ).expect(200);
    await api("get", `/tasks/${task._id}`, outsider).expect(403);
    expect(await Activity.countDocuments({ taskId: task._id })).toBe(
      activitiesBefore,
    );
    expect(await Task.findById(task._id)).not.toBeNull();
  });

  test("team members and outsiders cannot perform owner operations", async () => {
    await api("patch", `/teams/${workspace.teamId}`, member, {
      name: "Denied",
    }).expect(403);
    await api("delete", `/teams/${workspace.teamId}`, member).expect(403);
    await api("post", `/teams/${workspace.teamId}/members`, member, {
      email: outsider.email,
    }).expect(403);
    await api(
      "delete",
      `/teams/${workspace.teamId}/members/${member.id}`,
      member,
    ).expect(403);
    await api("get", `/teams/${workspace.teamId}`, outsider).expect(403);
    await api("get", `/teams/${workspace.teamId}/boards`, outsider).expect(403);
    await api("post", `/teams/${workspace.teamId}/members`, owner, {
      email: member.email,
    }).expect(409);
    await api(
      "delete",
      `/teams/${workspace.teamId}/members/${owner.id}`,
      owner,
    ).expect(409);
  });

  test("global admin can support teams without membership", async () => {
    await api("get", `/teams/${workspace.teamId}`, admin).expect(200);
    await api("patch", `/teams/${workspace.teamId}`, admin, {
      name: "Support update",
    }).expect(200);
    await api("post", `/teams/${workspace.teamId}/boards`, admin, {
      title: "Support board",
    }).expect(201);
  });
});

describe("boards and columns", () => {
  test("create, list, read, rename, and soft-delete a board", async () => {
    const board = await api(
      "get",
      `/boards/${workspace.boardId}`,
      member,
    ).expect(200);
    expect(board.body.teamId).toBe(workspace.teamId);
    const list = await api(
      "get",
      `/teams/${workspace.teamId}/boards`,
      member,
    ).expect(200);
    expect(list.body.map((entry: { _id: string }) => entry._id)).toContain(
      workspace.boardId,
    );
    const changed = await api("patch", `/boards/${workspace.boardId}`, owner, {
      title: "Renamed board",
    }).expect(200);
    expect(changed.body.title).toBe("Renamed board");
    const task = await createTask();
    await api("delete", `/boards/${workspace.boardId}`, member).expect(403);
    await api("delete", `/boards/${workspace.boardId}`, owner).expect(200);
    await api("get", `/boards/${workspace.boardId}`, owner).expect(404);
    await api("get", `/columns/${workspace.todo}`, owner).expect(404);
    await api("get", `/tasks/${task._id}`, owner).expect(404);
    expect((await Board.findById(workspace.boardId))!.deletedAt).toBeInstanceOf(
      Date,
    );
    expect(await Task.findById(task._id)).not.toBeNull();
    const after = await api(
      "get",
      `/teams/${workspace.teamId}/boards`,
      owner,
    ).expect(200);
    expect(after.body.map((entry: { _id: string }) => entry._id)).not.toContain(
      workspace.boardId,
    );
  });

  test("columns can be read, renamed, ordered, configured, and soft-deleted", async () => {
    const columns = await api(
      "get",
      `/boards/${workspace.boardId}/columns`,
      member,
    ).expect(200);
    expect(columns.body.map((entry: { title: string }) => entry.title)).toEqual(
      ["Todo", "In Progress", "Done"],
    );
    await api("get", `/columns/${workspace.todo}`, member).expect(200);
    const changed = await api("patch", `/columns/${workspace.done}`, owner, {
      title: "Ready",
      position: 0,
      allowedTransitions: [],
    }).expect(200);
    expect(changed.body.title).toBe("Ready");
    expect(changed.body.allowedTransitions).toEqual([]);
    const ordered = await api(
      "get",
      `/boards/${workspace.boardId}/columns`,
      member,
    ).expect(200);
    expect(ordered.body[0]._id).toBe(workspace.done);
    await api("delete", `/columns/${workspace.done}`, owner).expect(200);
    await api("get", `/columns/${workspace.done}`, owner).expect(404);
    expect((await Column.findById(workspace.done))!.deletedAt).toBeInstanceOf(
      Date,
    );
  });

  test("members cannot create, rename, or delete boards and columns", async () => {
    await api("post", `/teams/${workspace.teamId}/boards`, member, {
      title: "Denied",
    }).expect(403);
    await api("patch", `/boards/${workspace.boardId}`, member, {
      title: "Denied",
    }).expect(403);
    await api("post", `/boards/${workspace.boardId}/columns`, member, {
      title: "Denied",
      position: 4,
    }).expect(403);
    await api("patch", `/columns/${workspace.todo}`, member, {
      title: "Denied",
    }).expect(403);
    await api("delete", `/columns/${workspace.todo}`, member).expect(403);
    await api("get", `/boards/${workspace.boardId}`, outsider).expect(403);
    await api("get", `/columns/${workspace.todo}`, outsider).expect(403);
  });

  test("a column with active tasks cannot be deleted or configured with a foreign destination", async () => {
    await createTask();
    await api("delete", `/columns/${workspace.todo}`, owner).expect(409);
    expect((await Column.findById(workspace.todo))!.deletedAt).toBeNull();
    await api("patch", `/columns/${workspace.todo}`, owner, {
      allowedTransitions: [new Types.ObjectId().toString()],
    }).expect(400);
    const anotherBoard = await api(
      "post",
      `/teams/${workspace.teamId}/boards`,
      owner,
      { title: "Other board" },
    ).expect(201);
    const otherColumn = await api(
      "post",
      `/boards/${anotherBoard.body._id}/columns`,
      owner,
      {
        title: "Elsewhere",
        position: 1,
      },
    ).expect(201);
    await api("patch", `/columns/${workspace.todo}`, owner, {
      allowedTransitions: [otherColumn.body._id],
    }).expect(400);
  });
});

describe("tasks, activity, and move rules", () => {
  test("create, list, read, update, assign, and soft-delete a complete task", async () => {
    const deadline = "2030-03-20T12:00:00.000Z";
    const task = await createTask(member, {
      priority: "high",
      deadline,
      assignedUserId: member.id,
    });
    expect(task.priority).toBe("high");
    expect(task.deadline).toBe(deadline);
    expect(task.assignedUserId).toBe(member.id);
    expect((await Task.findById(task._id))!.title).toBe("Prepare presentation");
    await api("get", `/tasks/${task._id}`, member).expect(200);
    const list = await api(
      "get",
      `/columns/${workspace.todo}/tasks`,
      member,
    ).expect(200);
    expect(list.body.map((entry: { _id: string }) => entry._id)).toContain(
      task._id,
    );
    const updated = await api("patch", `/tasks/${task._id}`, member, {
      title: "Presentation ready",
      description: "Updated",
      priority: "low",
      deadline: null,
      assignedUserId: owner.id,
    }).expect(200);
    expect(updated.body.title).toBe("Presentation ready");
    expect(updated.body.deadline).toBeNull();
    expect(updated.body.assignedUserId).toBe(owner.id);
    await api("delete", `/tasks/${task._id}`, member).expect(403);
    await api("delete", `/tasks/${task._id}`, owner).expect(200);
    await api("get", `/tasks/${task._id}`, owner).expect(404);
    expect((await Task.findById(task._id))!.deletedAt).toBeInstanceOf(Date);
    const after = await api(
      "get",
      `/columns/${workspace.todo}/tasks`,
      owner,
    ).expect(200);
    expect(after.body.map((entry: { _id: string }) => entry._id)).not.toContain(
      task._id,
    );
  });

  test("a task moves through Todo, In Progress, Done and logs domain changes", async () => {
    const task = await createTask();
    await api("patch", `/tasks/${task._id}`, member, {
      assignedUserId: member.id,
    }).expect(200);
    const moved = await api("patch", `/tasks/${task._id}/move`, member, {
      columnId: workspace.progress,
    }).expect(200);
    expect(moved.body._id).toBe(task._id);
    expect(moved.body.columnId).toBe(workspace.progress);
    await api("patch", `/tasks/${task._id}/move`, member, {
      columnId: workspace.done,
    }).expect(200);
    await api("post", `/tasks/${task._id}/comments`, member, {
      text: "Finished",
    }).expect(201);
    const activities = await api(
      "get",
      `/tasks/${task._id}/activities`,
      member,
    ).expect(200);
    expect(activities.body.length).toBeGreaterThanOrEqual(5);
    expect(
      activities.body.map((activity: { action: string }) => activity.action),
    ).toEqual(
      expect.arrayContaining(["created", "assigned", "moved", "commented"]),
    );
    expect(JSON.stringify(activities.body)).not.toContain("Finished");
    for (const activity of activities.body) {
      expect(activity.taskId).toBe(task._id);
      expect(activity.actorId).toBe(member.id);
      expect(typeof activity.action).toBe("string");
      expect(activity.createdAt).toBeDefined();
      expect(JSON.stringify(activity)).not.toContain(password);
      expect(JSON.stringify(activity)).not.toContain(member.email);
    }
    expect((await Task.findById(task._id))!.columnId.toString()).toBe(
      workspace.done,
    );
  });

  test("column transition whitelist blocks shortcuts and an empty list blocks all moves", async () => {
    await api("patch", `/columns/${workspace.todo}`, owner, {
      allowedTransitions: [workspace.progress],
    }).expect(200);
    const task = await createTask();
    const countBefore = await Activity.countDocuments({ taskId: task._id });
    await api("patch", `/tasks/${task._id}/move`, member, {
      columnId: workspace.done,
    }).expect(409);
    expect((await Task.findById(task._id))!.columnId.toString()).toBe(
      workspace.todo,
    );
    expect(await Activity.countDocuments({ taskId: task._id })).toBe(
      countBefore,
    );
    await api("patch", `/tasks/${task._id}/move`, member, {
      columnId: workspace.progress,
    }).expect(200);
    await api("patch", `/columns/${workspace.progress}`, owner, {
      allowedTransitions: [],
    }).expect(200);
    await api("patch", `/tasks/${task._id}/move`, member, {
      columnId: workspace.done,
    }).expect(409);
    await api("patch", `/columns/${workspace.progress}`, owner, {
      allowedTransitions: null,
    }).expect(200);
    await api("patch", `/tasks/${task._id}/move`, member, {
      columnId: workspace.done,
    }).expect(200);
  });

  test("cross-team moves, assignments, and resource access are rejected", async () => {
    const other = await createWorkspace(outsider);
    const task = await createTask();
    await api("patch", `/tasks/${task._id}/move`, member, {
      columnId: other.todo,
    }).expect(403);
    await api("patch", `/tasks/${task._id}`, member, {
      assignedUserId: outsider.id,
    }).expect(400);
    await api("post", `/columns/${workspace.todo}/tasks`, member, {
      title: "Invalid assignment",
      assignedUserId: outsider.id,
    }).expect(400);
    await api("get", `/tasks/${task._id}`, outsider).expect(403);
    await api("get", `/tasks/${task._id}/activities`, outsider).expect(403);
    await api("get", `/columns/${workspace.todo}/tasks`, outsider).expect(403);
    await api("post", `/columns/${workspace.todo}/tasks`, outsider, {
      title: "Denied",
    }).expect(403);
    await api("patch", `/tasks/${task._id}`, outsider, {
      title: "Denied",
    }).expect(403);
    await api("delete", `/tasks/${task._id}`, outsider).expect(403);
    await api("get", `/tasks/${task._id}`, admin).expect(200);
  });

  test("activity write failures roll back task and comment mutations atomically", async () => {
    const task = await createTask();
    const activityCount = await Activity.countDocuments({ taskId: task._id });
    const db = mongoose.connection.db!;
    await db.command({
      collMod: "activities",
      validator: { action: "intentionally-unwritable-in-this-test" },
      validationLevel: "strict",
      validationAction: "error",
    });
    try {
      await api("post", `/columns/${workspace.todo}/tasks`, member, {
        title: "Must roll back",
      }).expect(500);
      expect(await Task.countDocuments()).toBe(1);
      await api("patch", `/tasks/${task._id}`, member, {
        title: "Must roll back",
      }).expect(500);
      expect((await Task.findById(task._id))!.title).toBe(task.title);
      await api("patch", `/tasks/${task._id}/move`, member, {
        columnId: workspace.progress,
      }).expect(500);
      expect((await Task.findById(task._id))!.columnId.toString()).toBe(
        workspace.todo,
      );
      await api("delete", `/tasks/${task._id}`, owner).expect(500);
      expect((await Task.findById(task._id))!.deletedAt).toBeNull();
      const failed = await api("post", `/tasks/${task._id}/comments`, member, {
        text: "Must roll back",
      }).expect(500);
      expect(failed.body.stack).toBeUndefined();
      expect(await Comment.countDocuments()).toBe(0);
      expect(await Activity.countDocuments({ taskId: task._id })).toBe(
        activityCount,
      );
    } finally {
      await db.command({ collMod: "activities", validator: {} });
    }
  });
});

describe("comments", () => {
  test("create, list, read, edit, and delete comments with author permission", async () => {
    const task = await createTask();
    const created = await api("post", `/tasks/${task._id}/comments`, member, {
      text: "First comment",
    }).expect(201);
    expect(created.body.authorId).toBe(member.id);
    expect(created.body.taskId).toBe(task._id);
    await api("get", `/comments/${created.body._id}`, owner).expect(200);
    const list = await api("get", `/tasks/${task._id}/comments`, member).expect(
      200,
    );
    expect(list.body.map((entry: { _id: string }) => entry._id)).toContain(
      created.body._id,
    );
    const updated = await api(
      "patch",
      `/comments/${created.body._id}`,
      member,
      { text: "Edited" },
    ).expect(200);
    expect(updated.body.text).toBe("Edited");
    await api("delete", `/comments/${created.body._id}`, member).expect(200);
    await api("get", `/comments/${created.body._id}`, owner).expect(404);
    const hidden = await api(
      "get",
      `/tasks/${task._id}/comments`,
      member,
    ).expect(200);
    expect(hidden.body).toHaveLength(0);
  });

  test("other members cannot edit comments while owner/admin can moderate", async () => {
    await api("post", `/teams/${workspace.teamId}/members`, owner, {
      email: outsider.email,
    }).expect(201);
    const task = await createTask();
    const comment = await api("post", `/tasks/${task._id}/comments`, member, {
      text: "Member comment",
    }).expect(201);
    await api("patch", `/comments/${comment.body._id}`, outsider, {
      text: "Denied",
    }).expect(403);
    await api("delete", `/comments/${comment.body._id}`, outsider).expect(403);
    await api("patch", `/comments/${comment.body._id}`, owner, {
      text: "Moderated",
    }).expect(200);
    await api("delete", `/comments/${comment.body._id}`, admin).expect(200);
  });

  test("outsiders and soft-deleted parent tasks cannot expose comments", async () => {
    const task = await createTask();
    const comment = await api("post", `/tasks/${task._id}/comments`, member, {
      text: "Private team comment",
    }).expect(201);
    await api("get", `/tasks/${task._id}/comments`, outsider).expect(403);
    await api("post", `/tasks/${task._id}/comments`, outsider, {
      text: "Denied",
    }).expect(403);
    await api("get", `/comments/${comment.body._id}`, outsider).expect(403);
    await api("delete", `/tasks/${task._id}`, owner).expect(200);
    await api("get", `/comments/${comment.body._id}`, member).expect(404);
    await api("get", `/tasks/${task._id}/comments`, member).expect(404);
    await api("get", `/tasks/${task._id}/activities`, member).expect(404);
  });
});

describe("Zod input and consistent error handling", () => {
  test.each([
    ["get", "/teams/bad-id"],
    ["get", "/boards/bad-id"],
    ["get", "/columns/bad-id"],
    ["get", "/tasks/bad-id"],
    ["get", "/comments/bad-id"],
    ["get", "/tasks/bad-id/activities"],
  ] as [Method, string][])(
    "%s %s rejects malformed IDs with 400",
    async (method, path) => {
      const error = await api(method, path, member).expect(400);
      expect(typeof error.body.message).toBe("string");
      expect(JSON.stringify(error.body)).not.toContain("stack");
    },
  );

  test.each([
    ["get", "/teams"],
    ["get", "/boards"],
    ["get", "/columns"],
    ["get", "/tasks"],
    ["get", "/comments"],
  ] as [Method, string][])(
    "%s %s/:id returns 404 for a nonexistent resource",
    async (method, path) => {
      await api(method, `${path}/${new Types.ObjectId()}`, member).expect(404);
    },
  );

  test("strict body validation rejects wrong types, unknown keys, empty patches, and invalid query input", async () => {
    await api("post", "/auth/register", undefined, {
      name: "A",
      email: 123,
      password,
    }).expect(400);
    await api("post", "/auth/login", undefined, {
      email: { $ne: null },
      password,
    }).expect(400);
    await api("post", "/teams", owner, {
      name: "Valid",
      ownerId: outsider.id,
    }).expect(400);
    await api("patch", `/teams/${workspace.teamId}`, owner, {}).expect(400);
    await api("post", `/boards/${workspace.boardId}/columns`, owner, {
      title: "Invalid",
      position: "first",
    }).expect(400);
    await api("post", `/columns/${workspace.todo}/tasks`, member, {
      title: "Invalid",
      priority: "urgent",
    }).expect(400);
    await api("post", `/columns/${workspace.todo}/tasks`, member, {
      title: "Invalid",
      deadline: "not-a-date",
    }).expect(400);
    const task = await createTask();
    await api("patch", `/tasks/${task._id}`, member, {}).expect(400);
    await api("patch", `/tasks/${task._id}/move`, member, {
      columnId: "bad-id",
    }).expect(400);
    await api("post", `/tasks/${task._id}/comments`, member, {
      text: " ",
    }).expect(400);
    await api("get", "/teams?unexpected=true", member).expect(400);
    await api("get", `/tasks/${task._id}?unexpected=true`, member).expect(400);
  });

  test("missing or malformed JSON and unknown endpoints produce safe JSON errors", async () => {
    await request(app).post("/auth/register").expect(400);
    const malformed = await request(app)
      .post("/auth/register")
      .set("Content-Type", "application/json")
      .send('{"name":')
      .expect(400);
    expect(typeof malformed.body.message).toBe("string");
    expect(malformed.body.stack).toBeUndefined();
    const missing = await api("get", "/missing-route", member).expect(404);
    expect(typeof missing.body.message).toBe("string");
  });
});
