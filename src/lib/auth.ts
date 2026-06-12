// =============================================================================
// NextAuth v5 — Full Configuration with Prisma + Credentials
// =============================================================================
// This is the main auth configuration file. It extends the edge-compatible
// config with the Credentials provider and Prisma database queries.
// 
// Auth Flow:
// 1. User submits email + password
// 2. We query the User table by email
// 3. Compare password with bcrypt hash
// 4. Return user object → NextAuth creates JWT token
// 5. JWT is stored in an HTTP-only cookie
// =============================================================================

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      /**
       * Validates user credentials against the database.
       * Returns the user object if valid, null otherwise.
       */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        // Query user from database
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        // Verify password against bcrypt hash
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);

        if (!isValidPassword) {
          return null;
        }

        // Return user object (this gets encoded into the JWT)
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt", // Use JWT instead of database sessions
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Adds the user ID to the JWT token so we can access it in sessions.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    /**
     * Makes the user ID available in the session object.
     */
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
