import type { NextAuthConfig } from "next-auth";
import { LOGIN_ROUTE } from "@/lib/routes";

/**
 * Auth.js configuration without any database-backed provider.
 *
 * Kept separate from auth.ts so middleware can import it: middleware runs on
 * the edge runtime, where Prisma and bcrypt cannot. Providers that need the
 * database are added in auth.ts, which only runs in Node.
 */
export const authConfig = {
  pages: {
    signIn: LOGIN_ROUTE,
    error: LOGIN_ROUTE,
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    /**
     * Persist identity onto the token at sign-in. The JWT is the only thing
     * middleware can read, so role and tenant must live here.
     */
    jwt({ token, user }) {
      if (user) {
        // Auth.js types User.id as optional, but the credentials provider
        // always returns one - it comes straight from the database row.
        token.id = user.id!;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.sessionVersion = user.sessionVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.sessionVersion = token.sessionVersion ?? 0;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
