import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Missing MONGODB_URI");
}
await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "flota" });

const superEmail = process.env.SUPERADMIN_DEFAULT_EMAIL || "superadmin@example.com";
const superPass = process.env.SUPERADMIN_DEFAULT_PASSWORD || "superadmin123";
const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || "admin@example.com";
const adminPass = process.env.ADMIN_DEFAULT_PASSWORD || "admin123";

const hashedSuper = await bcrypt.hash(superPass, 10);
const hashedAdmin = await bcrypt.hash(adminPass, 10);

await User.deleteMany({ email: { $in: [superEmail, adminEmail] } });

await User.create([
  {
    email: superEmail,
    password: hashedSuper,
    role: "superadmin",
    name: "Super Admin"
  },
  {
    email: adminEmail,
    password: hashedAdmin,
    role: "admin",
    name: "Admin"
  }
]);

console.log("Seed applied with credentials:");
console.log("Super admin:", superEmail);
console.log("Admin:", adminEmail);

await mongoose.disconnect();
