# TaskBoard

TaskBoard is a simple REST API where users can create teams and organize work using boards, columns, and tasks. Teams have admin and member roles, and protected routes use JWT authentication.

## Tech stack

- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose
- bcrypt
- JWT

## Setup

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to a new file named `.env`.

3. Add your own environment values:

   ```env
   PORT=3000
   MONGODB_URI=your-mongodb-connection-string
   JWT_SECRET=your-long-random-secret
   ```

Never commit the real `.env` file.

Run the development server:

```bash
npm run dev
```

Build TypeScript:

```bash
npm run build
```

Run the compiled server:

```bash
npm start
```

Run the automated tests:

```bash
npm test
```

## Architecture

The main database relationship is:

```text
User
  ↓ team membership and role
Team
  ↓
Board
  ↓
Column
  ↓
Task
```

- A Team stores its members and each member's role.
- A Board stores the ID of its Team.
- A Column stores the ID of its Board.
- A Task stores the ID of its Column.
- A Task may also store the ID of an assigned User.

For task permissions, the backend follows Task → Column → Board → Team and checks the authenticated user in `team.members`.

### Team roles

- `admin`: Can add members, create boards and columns, and delete tasks.
- `member`: Can view team data and create, update, assign, and move tasks.

Both roles can view boards, columns, and tasks in their own team. Users outside the team receive `403 Forbidden`.

## API

Protected routes require this header:

```text
Authorization: Bearer <token>
```

### Health

| Method | Path | Token | Purpose |
|---|---|---:|---|
| GET | `/health` | No | Check that the API is running |

### Authentication

| Method | Path | Token | Purpose |
|---|---|---:|---|
| POST | `/auth/register` | No | Register a user |
| POST | `/auth/login` | No | Log in and receive a JWT |

Register body:

```json
{
  "name": "Mohammed",
  "email": "mohammed@example.com",
  "password": "password123"
}
```

Login body:

```json
{
  "email": "mohammed@example.com",
  "password": "password123"
}
```

### Teams

| Method | Path | Token | Purpose |
|---|---|---:|---|
| POST | `/teams` | Yes | Create a team; creator becomes admin |
| GET | `/teams` | Yes | List teams the user belongs to |
| POST | `/teams/:teamId/members` | Yes, admin | Add an existing user by email |

### Boards

| Method | Path | Token | Purpose |
|---|---|---:|---|
| POST | `/teams/:teamId/boards` | Yes, admin | Create a board in a team |
| GET | `/teams/:teamId/boards` | Yes, member | List a team's boards |

### Columns

| Method | Path | Token | Purpose |
|---|---|---:|---|
| POST | `/boards/:boardId/columns` | Yes, admin | Create a column with a numeric position |
| GET | `/boards/:boardId/columns` | Yes, member | List columns ordered by position |

Example column body:

```json
{
  "title": "Todo",
  "position": 1
}
```

### Tasks

| Method | Path | Token | Purpose |
|---|---|---:|---|
| POST | `/columns/:columnId/tasks` | Yes, member | Create a task |
| GET | `/columns/:columnId/tasks` | Yes, member | List tasks in a column |
| GET | `/tasks/:taskId` | Yes, member | Get one task |
| PATCH | `/tasks/:taskId` | Yes, member | Update task fields |
| DELETE | `/tasks/:taskId` | Yes, admin | Delete a task |
| PATCH | `/tasks/:taskId/move` | Yes, member | Move a task inside the same team |

Create task body:

```json
{
  "title": "Write report",
  "description": "Prepare the first draft",
  "assignedUserId": "optional-team-member-id"
}
```

Move task body:

```json
{
  "columnId": "destination-column-id"
}
```

## HTTP status codes

- `200 OK`: A request succeeded.
- `201 Created`: A team, membership, board, column, or task was created.
- `400 Bad Request`: Required or valid input is missing.
- `401 Unauthorized`: Authentication is missing or invalid.
- `403 Forbidden`: The user is authenticated but lacks team permission.
- `404 Not Found`: The requested database resource does not exist.
- `500 Internal Server Error`: An unexpected server or database error occurred.

## Authentication

Registration validates the input, checks for an existing email, hashes the password with bcrypt, and stores only the hash.

Login finds the user and uses `bcrypt.compare()` to check the submitted password. A successful login creates a JWT containing the user ID. The token expires after one hour.

Protected requests send the JWT as a Bearer token. The authentication middleware verifies the signature, expiration, and user ID format. It then makes the user ID available as `request.userId`.

`JWT_SECRET` is read from the environment and is never hardcoded.

## Permissions

| Action | Admin | Member | Non-member |
|---|---:|---:|---:|
| Add team members | Yes | No | No |
| Create boards | Yes | No | No |
| View boards | Yes | Yes | No |
| Create columns | Yes | No | No |
| View columns | Yes | Yes | No |
| Create tasks | Yes | Yes | No |
| View tasks | Yes | Yes | No |
| Update or move tasks | Yes | Yes | No |
| Delete tasks | Yes | No | No |

Assigned users must exist and belong to the task's team. Tasks cannot be moved to a column belonging to another team.

## Tests

Run all tests with:

```bash
npm test
```

The tests cover:

- Health and authentication responses
- Missing and invalid request data
- JWT protection
- Team roles and duplicate membership
- Board and column permissions
- Column ordering
- Task creation, listing, updates, assignment, and deletion
- Same-team and cross-team task moves
- Malformed IDs, missing resources, and permission failures

HTTP tests exercise the real Express routes. Database-dependent controller tests replace Mongoose operations with small in-memory values, so the suite does not require a live MongoDB database.

## Learning and demo flow

The main request flow is:

```text
request
  ↓
authentication middleware
  ↓
route
  ↓
controller
  ↓
Mongoose
  ↓
MongoDB
  ↓
JSON response
```

Start with `src/app.ts` to see route registration. Follow a route into its controller, then inspect the model used by that controller. For protected resources, also follow the relationship back to Team and its members.
