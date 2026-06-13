"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MobileSidebar } from "@/components/layout/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession, signOut } from "next-auth/react";
import { getInitials } from "@/lib/utils";
import { ChevronRight, LogOut, Settings, User } from "lucide-react";

/* ---------- Page titles mapping ---------- */
const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/groups": "Groups",
  "/expenses": "Expenses",
  "/settlements": "Settlements",
  "/import": "Import CSV",
  "/audit": "Audit Log",
  "/expenses/new": "New Expense",
};

function getPageTitle(pathname: string): string {
  // Check exact matches first
  if (pageTitles[pathname]) return pageTitles[pathname];

  // Check prefix matches
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path)) return title;
  }

  return "SplitSmart";
}

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = pageTitles[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, href: currentPath });
  }

  return crumbs;
}

export function Navbar() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const breadcrumbs = getBreadcrumbs(pathname);
  const { data: session } = useSession();

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 pt-4 sticky top-0 z-40">
      <header className="h-16 glass-nav rounded-2xl px-4 w-full transition-all duration-300">
        <div className="w-full h-full flex items-center justify-between gap-4">
          {/* Mobile hamburger */}
        <MobileSidebar />

        {/* Left: Title and breadcrumbs */}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{pageTitle}</h1>
          {breadcrumbs.length > 1 && (
            <nav className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={crumb.href}>
                  {i > 0 && <ChevronRight className="h-2 w-2" />}
                  {i === breadcrumbs.length - 1 ? (
                    <span className="text-foreground">{crumb.label}</span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>

        {/* Right: User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 hover:bg-accent transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-splitwise-teal to-splitwise-green text-white text-xs font-bold">
                {session?.user?.name ? getInitials(session.user.name) : "U"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:block text-sm font-medium">
              {session?.user?.name || "Loading..."}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </header>
    </div>
  );
}
