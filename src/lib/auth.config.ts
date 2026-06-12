// =============================================================================
// NextAuth v5 — Edge-Compatible Configuration
// =============================================================================
// This file contains only Edge-compatible configuration (no Prisma, no bcrypt).
// It's used by middleware for route protection on the Edge runtime.
// The full configuration with database adapter is in auth.ts.
// =============================================================================

import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  callbacks: {
    /**
     * Controls whether a user is allowed to access a route.
     * Redirects unauthenticated users to /login for protected routes.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtectedRoute = nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/groups") ||
        nextUrl.pathname.startsWith("/expenses") ||
        nextUrl.pathname.startsWith("/settlements") ||
        nextUrl.pathname.startsWith("/import") ||
        nextUrl.pathname.startsWith("/audit");

      if (isProtectedRoute) {
        if (isLoggedIn) return true;
        return false; // Redirect to /login
      }

      // Redirect authenticated users away from auth pages
      if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
  providers: [], // Providers are configured in auth.ts
};
