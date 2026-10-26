import "dotenv/config";
import { openDatabase, seed } from "./db.js";
import { createApp } from "./app.js";
const db = openDatabase();
if (!db.prepare("SELECT id FROM users LIMIT 1").get()) seed(db);
const server = createApp(db).listen(
  Number(process.env.PORT || 3001),
  "0.0.0.0",
  () => console.log(`BookLeaf listening on port ${process.env.PORT || 3001}`),
);
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
