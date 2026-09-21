# TaskBoard Live Demo Guide

Use this guide to practice the project flow. Understand why each result happens instead of memorizing only the words.

## Before the demo

1. Start MongoDB or confirm your hosted MongoDB database is available.
2. Check `.env`:

   ```env
   PORT=3000
   MONGODB_URI=your-mongodb-connection-string
   JWT_SECRET=your-long-random-secret
   ```

3. Install and start:

   ```bash
   npm install
   npm run dev
   ```

4. Open your API client, such as Postman.
5. Prepare variables for both JWTs and the IDs returned during the demo.

Suggested variables:

```text
userAToken
userBToken
outsiderToken
teamId
otherTeamId
boardId
todoColumnId
progressColumnId
doneColumnId
otherTeamColumnId
taskId
```

For protected requests, send:

```text
Authorization: Bearer <token>
Content-Type: application/json
```

## Live-demo order

### 1. Health check

```http
GET /health
```

Expected: `200`

Say: “The health route confirms that Express is running and can answer requests.”

### 2. Register User A

```http
POST /auth/register
```

```json
{
  "name": "User A",
  "email": "usera@example.com",
  "password": "password123"
}
```

Expected: `201`

Say: “The controller validates the input, checks the email, hashes the password with bcrypt, and stores the hash.”

### 3. Register User B

Use the same request with `User B` and `userb@example.com`.

Expected: `201`

Say: “Email is unique, so each account needs a different address.”

### 4. Register an outsider

Create a third user who will not join User A's team.

Expected: `201`

Say: “I will use this account to demonstrate forbidden cross-team access.”

### 5. Login User A

```http
POST /auth/login
```

```json
{
  "email": "usera@example.com",
  "password": "password123"
}
```

Expected: `200` with `{ "token": "..." }`

Say: “bcrypt compares the submitted password with the stored hash. The server then signs a one-hour JWT containing the user ID.”

Save the token as `userAToken`. Log in User B and the outsider in the same way.

### 6. Bad login

Submit the wrong password.

Expected: `401`

Say: “The server uses the same error for a missing user and a wrong password, so it does not reveal which accounts exist.”

### 7. Protected request without a token

```http
GET /teams
```

Expected: `401`

Say: “The authentication middleware stops the request before the controller runs.”

### 8. Create a team as User A

```http
POST /teams
Authorization: Bearer <userAToken>
```

```json
{
  "name": "Demo Team"
}
```

Expected: `201`

Save `teamId`.

Say: “The authenticated user ID is inserted into members with the admin role.”

### 9. Show that the creator is admin

Point to the response:

```json
{
  "user": "user-a-id",
  "role": "admin"
}
```

Say: “Roles belong to a team membership, so the same user could have a different role in another team.”

### 10. Add User B

```http
POST /teams/:teamId/members
Authorization: Bearer <userAToken>
```

```json
{
  "email": "userb@example.com"
}
```

Expected: `201`

Say: “The server finds an existing user by email, prevents duplicates, and adds the member role.”

### 11. Add User B again

Repeat the request.

Expected: `400`

Say: “Duplicate membership is rejected before saving.”

### 12. Member attempts an admin action

Repeat the add-member request using `userBToken`.

Expected: `403`

Say: “User B is authenticated, but authorization fails because only admins can add members.”

### 13. Create a board

```http
POST /teams/:teamId/boards
Authorization: Bearer <userAToken>
```

```json
{
  "title": "Project Board"
}
```

Expected: `201`

Save `boardId`.

Say: “The board stores `teamId`, and board creation requires the admin role.”

### 14. List boards as User B

```http
GET /teams/:teamId/boards
Authorization: Bearer <userBToken>
```

Expected: `200`

Say: “Members cannot create boards, but they may view their team's boards.”

### 15. Create Todo

```http
POST /boards/:boardId/columns
Authorization: Bearer <userAToken>
```

```json
{
  "title": "Todo",
  "position": 1
}
```

Expected: `201`. Save `todoColumnId`.

### 16. Create In Progress and Done

Create two more columns with positions `2` and `3`.

Expected: `201` each.

Say: “Position controls the order; the titles themselves do not have special behavior.”

### 17. List columns

```http
GET /boards/:boardId/columns
Authorization: Bearer <userBToken>
```

Expected: `200`, ordered Todo, In Progress, Done.

Say: “The Mongoose query sorts by position ascending.”

### 18. Create a task

```http
POST /columns/:todoColumnId/tasks
Authorization: Bearer <userBToken>
```

```json
{
  "title": "Prepare presentation",
  "description": "Create live-demo notes"
}
```

Expected: `201`. Save `taskId`.

Say: “Both admins and members can create tasks. The task stores its column ID.”

### 19. List tasks

```http
GET /columns/:todoColumnId/tasks
Authorization: Bearer <userBToken>
```

Expected: `200`

Say: “Access is checked through Column → Board → Team before tasks are returned.”

### 20. Update and assign the task

```http
PATCH /tasks/:taskId
Authorization: Bearer <userBToken>
```

```json
{
  "title": "Prepare final presentation",
  "assignedUserId": "user-b-id"
}
```

Expected: `200`

Say: “The server verifies that the assigned user exists and belongs to this team.”

### 21. Try an invalid assignment

Use the outsider's user ID as `assignedUserId`.

Expected: `400`

Say: “An existing user still cannot be assigned unless they belong to the task's team.”

### 22. Move to In Progress

```http
PATCH /tasks/:taskId/move
Authorization: Bearer <userBToken>
```

```json
{
  "columnId": "in-progress-column-id"
}
```

Expected: `200`

Say: “Moving changes only `task.columnId` after checking both sides of the relationship.”

### 23. Move to Done

Repeat with `doneColumnId`.

Expected: `200`

### 24. Cross-team move

Create another team, board, and column using the outsider account. Try moving User A's task to that column.

Expected: `403`

Say: “The current and destination boards have different team IDs, so the move is forbidden.”

### 25. Malformed destination ID

```json
{
  "columnId": "not-an-object-id"
}
```

Expected: `400`

Say: “Body input is invalid, so it is rejected before querying MongoDB.”

### 26. Missing resource

Use a valid-looking ObjectId that does not exist.

Expected: `404`

Say: “The ID format is valid, but there is no matching document.”

### 27. Outsider reads a task

```http
GET /tasks/:taskId
Authorization: Bearer <outsiderToken>
```

Expected: `403`

Say: “The token is valid, but the user is not in the task's team.”

### 28. Delete the task

First try with User B.

Expected: `403`

Then use User A:

```http
DELETE /tasks/:taskId
Authorization: Bearer <userAToken>
```

Expected: `200`

Say: “Task deletion is restricted to team admins.”

### 29. Verify deletion

```http
GET /tasks/:taskId
Authorization: Bearer <userAToken>
```

Expected: `404`

Say: “The task no longer exists in MongoDB.”

## Important files to open

| File | What to explain |
|---|---|
| `src/app.ts` | JSON middleware and route registration |
| `src/server.ts` | Database connection before server startup |
| `src/config/database.ts` | Mongoose connection using `MONGODB_URI` |
| `src/models/User.ts` | User fields and unique email |
| `src/models/Team.ts` | Embedded memberships and roles |
| `src/models/Board.ts` | Board-to-Team relationship |
| `src/models/Column.ts` | Column-to-Board relationship and position |
| `src/models/Task.ts` | Task-to-Column and optional User assignment |
| `src/controllers/authController.ts` | bcrypt and JWT flow |
| `src/middleware/authMiddleware.ts` | Bearer token verification |
| `src/utils/teamAccess.ts` | Current role lookup |
| `src/controllers/taskController.ts` | Relationship tracing and task rules |
| `tests/taskboard.test.ts` | Important automated behavior checks |

## Common teacher questions

### Why hash passwords?

If the database is exposed, plain passwords would be immediately readable. bcrypt stores a one-way hash and compares passwords without decrypting it.

### What is inside the JWT?

The custom data is the user ID. The JWT library also adds issue and expiration times. Roles are not stored in the token.

### Authentication versus authorization?

Authentication identifies the user. Authorization checks whether that user may perform a particular action.

### Why are roles stored in Team?

A user can have different roles in different teams.

### How do task permissions work?

The backend follows Task → Column → Board → Team and checks the authenticated user in `team.members`.

### Why validate ObjectIds?

Malformed IDs can cause Mongoose cast errors. Validation allows the API to return a controlled `400` or `404` instead of `500`.

### Why not trust IDs from the client?

A user could send an ID belonging to another team. The server must load the relationships and verify ownership.

### How is a cross-team move prevented?

The controller compares the current board's `teamId` with the destination board's `teamId`.

### Why use environment variables?

Database addresses and JWT secrets are configuration and may be sensitive. They should not be hardcoded or committed.

## Common demo mistakes

- Forgetting `Content-Type: application/json`
- Forgetting the `Bearer ` prefix
- Using User A's token when trying to demonstrate a member restriction
- Copying a team ID where a board or column ID is required
- Forgetting to save IDs from responses
- Assigning by email when the task endpoint expects a user ID
- Using a malformed ID when you intend to demonstrate a valid but missing resource
- Reusing users from an older database state and getting duplicate-email responses
- Trying to delete as a member instead of an admin

## Troubleshooting checklist

1. Is MongoDB running or reachable?
2. Does `.env` exist?
3. Is `MONGODB_URI` correct?
4. Is `JWT_SECRET` present?
5. Is the backend running on the expected port?
6. Does the request use JSON and the correct HTTP method?
7. Does the request include `Authorization: Bearer <token>`?
8. Has the token expired?
9. Are you using the correct team, board, column, task, and user IDs?
10. Does the authenticated user belong to the correct team?
11. Is an admin token required for this action?
12. Check the terminal for the server's error message.

Before the real demonstration, run:

```bash
npm run build
npm test
```
