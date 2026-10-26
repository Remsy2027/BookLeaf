import "dotenv/config";
import { openDatabase, seed } from "./db.js";
const db = openDatabase();
seed(db);
db.close();
console.log(
  "Seed complete: 10 authors, 18 books, 1 admin. Existing records were preserved.",
);
