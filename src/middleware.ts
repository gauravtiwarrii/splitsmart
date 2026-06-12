// =============================================================================
// Next.js Middleware — Route Protection
// =============================================================================
// Uses the edge-compatible auth config to protect dashboard routes.
// Runs on every request matching the configured paths.
// =============================================================================

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  // Protect all dashboard-related routes
  matcher: [
    "/dashboard/:path*",
    "/groups/:path*",
    "/expenses/:path*",
    "/settlements/:path*",
    "/import/:path*",
    "/audit/:path*",
  ],
};

