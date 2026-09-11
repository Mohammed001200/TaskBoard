import "dotenv/config";
import app from "./app";
import { connectDatabase } from "./config/database";

const port = Number(process.env.PORT) || 3000;

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Could not start the server:", error);
    process.exit(1);
  }
}

startServer();
