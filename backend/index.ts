import { createApp } from "./app";
import { PORT } from "./config";

async function run() {
  const app = await createApp();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

run().catch((err) => {
  console.error("Failed to start the backend server:", err);
  process.exit(1);
});
