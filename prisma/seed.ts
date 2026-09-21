import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_USERS: Array<{
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}> = [
    { email: "admin@hrsign.local", fullName: "系统管理员", role: "SUPER_ADMIN", password: "Admin@123456" },
    { email: "hr@hrsign.local", fullName: "人事专员", role: "HR", password: "Hr@123456" },
    { email: "leader@hrsign.local", fullName: "部门负责人", role: "DEPT_LEADER", password: "Leader@123456" },
    { email: "employee@hrsign.local", fullName: "普通员工", role: "EMPLOYEE", password: "Employee@123456" },
  ];

async function main() {
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role, isActive: true, passwordHash },
      create: { email: u.email, fullName: u.fullName, role: u.role, passwordHash },
    });
    console.log(`seeded user: ${u.email} (${u.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
