// Prints a one-time link (valid 1 hour) where the owner sets the admin password. Run inside the app directory:
//   node scripts/owner-setup.mjs https://coach.stom-ad.com
// Does nothing once the owner exists: then reset access by deleting the owner row by hand.
import { createSetupToken } from "../lib/auth.ts";

const base = (process.argv[2] || "http://localhost:3001").replace(/\/$/, "");
const token = createSetupToken();
if (!token) {
  console.log("The owner account already exists; no link issued.");
  process.exit(1);
}
console.log(`${base}/setup?token=${token}`);
