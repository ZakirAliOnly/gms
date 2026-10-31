import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    sessionVersion: number;
    role: Role;
    /** Null for platform users (superadmin, admin); set for tenant accounts. */
    tenantId: string | null;
  }

  interface Session {
    user: {
      sessionVersion: number;
      id: string;
      role: Role;
      tenantId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    sessionVersion: number;
    id: string;
    role: Role;
    tenantId: string | null;
  }
}
