import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validators/auth";

/**
 * A bcrypt hash of a value nobody can supply. Compared against when no user
 * matches, so a missing account costs the same time as a wrong password and
 * the response cannot be used to enumerate valid emails.
 */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.4S8Z3xW1JQKp1Uu5aWvJ0PLZ0i6XBqO";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { tenant: { select: { status: true } } },
        });

        // Always run a comparison so timing does not reveal whether the
        // account exists.
        const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !passwordMatches) {
          return null;
        }

        // A disabled account cannot sign in, and neither can a tenant account
        // whose location has been suspended.
        if (user.status !== "ACTIVE") {
          return null;
        }

        if (user.tenant && user.tenant.status !== "ACTIVE") {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
});
