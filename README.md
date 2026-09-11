# TaskBoard

TaskBoard is a simple backend where users will be able to work with teams, boards, columns, and tasks.

## Technologies

- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose
- dotenv

## Installation

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to a new file named `.env`.

3. Add your MongoDB connection string to `MONGODB_URI` in `.env`.

## Run the backend

Run the project during development:

```bash
npm run dev
```

Build the TypeScript code:

```bash
npm run build
```

Run the compiled code:

```bash
npm start
```

When the server is running, `GET /health` returns:

```json
{
  "status": "ok"
}
```

## Environment variables

- `PORT`: The port used by the server. It defaults to `3000`.
- `MONGODB_URI`: The MongoDB connection string. It is required.
