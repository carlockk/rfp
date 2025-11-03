import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import RolePermission from "../models/RolePermission.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Missing MONGODB_URI");
}
await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "flota" });

const superEmail = process.env.SUPERADMIN_DEFAULT_EMAIL || "superadmin@example.com";
const superPass = process.env.SUPERADMIN_DEFAULT_PASSWORD || "superadmin123";
const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || "admin@example.com";
const adminPass = process.env.ADMIN_DEFAULT_PASSWORD || "admin123";

const rolesSeed = [
  { key: "superadmin", name: "Super Admin", description: "Control total del sistema", isSystem: true },
  { key: "admin", name: "Admin", description: "Gestiona equipos y usuarios tecnicos", isSystem: true },
  { key: "tecnico", name: "Tecnico", description: "Operaciones de campo", isSystem: true }
];

const permissionsSeed = [
  { key: "crear_usuario", name: "Crear usuario", description: "Puede crear usuarios", module: "usuarios" },
  { key: "asignar_equipo", name: "Asignar equipo", description: "Puede asignar equipos a operadores", module: "equipos" },
  { key: "editar_checklist", name: "Editar checklist", description: "Puede modificar plantillas de checklist", module: "mantenimiento" },
  { key: "ver_reporte", name: "Ver reportes", description: "Puede acceder a reportes y dashboards", module: "reportes" },
  { key: "registrar_lectura", name: "Registrar lectura", description: "Puede registrar lecturas y consumos", module: "operaciones" },
  { key: "ver_equipo", name: "Ver equipo", description: "Puede consultar información de equipos", module: "equipos" }
];

await Promise.all(
  rolesSeed.map((role) =>
    Role.updateOne({ key: role.key }, { $set: role }, { upsert: true })
  )
);

await Promise.all(
  permissionsSeed.map((perm) =>
    Permission.updateOne({ key: perm.key }, { $set: perm }, { upsert: true })
  )
);

const roleDocs = await Role.find({ key: { $in: rolesSeed.map((r) => r.key) } });
const permDocs = await Permission.find({ key: { $in: permissionsSeed.map((p) => p.key) } });

const roleMap = Object.fromEntries(roleDocs.map((role) => [role.key, role]));
const permMap = Object.fromEntries(permDocs.map((perm) => [perm.key, perm]));

const superAdminPermissions = permDocs.map((perm) => perm._id);
const adminPermissions = [
  permMap["asignar_equipo"]?._id,
  permMap["editar_checklist"]?._id,
  permMap["ver_reporte"]?._id,
  permMap["ver_equipo"]?._id
].filter(Boolean);

const rolesForCleanup = ["superadmin", "admin"]
  .map((key) => roleMap[key]?._id)
  .filter(Boolean);

if (rolesForCleanup.length) {
  await RolePermission.deleteMany({ role: { $in: rolesForCleanup } });
}

if (roleMap["superadmin"] && superAdminPermissions.length) {
  await RolePermission.insertMany(
    superAdminPermissions.map((permId) => ({
      role: roleMap["superadmin"]._id,
      permission: permId
    }))
  );
}

if (roleMap["admin"] && adminPermissions.length) {
  await RolePermission.insertMany(
    adminPermissions.map((permId) => ({
      role: roleMap["admin"]._id,
      permission: permId
    }))
  );
}

const hashedSuper = await bcrypt.hash(superPass, 10);
const hashedAdmin = await bcrypt.hash(adminPass, 10);

await User.deleteMany({ email: { $in: [superEmail, adminEmail] } });

await User.create([
  {
    email: superEmail,
    password: hashedSuper,
    role: "superadmin",
    name: "Super Admin",
    techProfile: ""
  },
  {
    email: adminEmail,
    password: hashedAdmin,
    role: "admin",
    name: "Admin",
    techProfile: ""
  }
]);

await User.updateMany(
  { role: "tecnico", $or: [{ techProfile: { $exists: false } }, { techProfile: "" }] },
  { $set: { techProfile: "externo" } }
);

console.log("Seed aplicada con credenciales:");
console.log("Super admin:", superEmail);
console.log("Admin:", adminEmail);

await mongoose.disconnect();
