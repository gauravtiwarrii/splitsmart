// =============================================================================
// NextAuth Type Augmentation
// =============================================================================
// Extends the default NextAuth types to include our custom user ID field.
// Without this, TypeScript won't know about session.user.id.
// =============================================================================

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
