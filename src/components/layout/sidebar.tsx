"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  Receipt,
  ArrowLeftRight,
  Upload,
  ScrollText,
  Wallet,
  LogOut,
  Moon,
  Sun,
  Menu,
  ChevronLeft,
} from "lucide-react";

/* ---------- Nav items ---------- */
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/settlements", label: "Settlements", icon: ArrowLeftRight },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
];

/* ---------- Logo ---------- */
function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-1">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
        <Wallet className="h-5 w-5 text-white" />
      </div>
      {!collapsed && (
        <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
          SplitSmart
        </span>
      )}
    </Link>
  );
}

/* ---------- NavLink ---------- */
function NavLink({
  item,
  collapsed,
}: {
  item: (typeof navItems)[0];
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 hover-lift",
        isActive
          ? "bg-primary/15 text-primary shadow-sm border border-primary/20"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground border border-transparent",
        collapsed && "justify-center px-2"
      )}
    >
      <item.icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {!collapsed && <span>{item.label}</span>}
      {isActive && !collapsed && (
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
      )}
    </Link>
  );
}

/* ---------- Sidebar content (shared between desktop and mobile) ---------- */
function SidebarContent({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
}) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Logo collapsed={collapsed} />
        {onToggleCollapse && !collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator className="mx-4 w-auto" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </nav>
      </ScrollArea>

      <Separator className="mx-4 w-auto" />

      {/* Footer */}
      <div className="p-4 space-y-3">
        {/* Theme toggle */}
        {mounted && (
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            {!collapsed && (
              <>
                <Sun className="h-4 w-4 text-muted-foreground" />
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
                <Moon className="h-4 w-4 text-muted-foreground" />
              </>
            )}
            {collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-8 w-8"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        )}

        {/* User */}
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs">
              {session?.user?.name ? session.user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session?.user?.name || "Loading..."}</p>
              <p className="text-xs text-muted-foreground truncate">{session?.user?.email || ""}</p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="h-8 w-8 shrink-0 hover:text-red-400 hover:bg-red-950/10"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Desktop Sidebar ---------- */
export function Sidebar() {
  return (
    <div className="hidden md:block w-full h-[calc(100vh-8rem)] sticky top-24 border border-border/40 rounded-3xl bg-card/40 backdrop-blur-3xl shadow-xl p-2 overflow-hidden relative z-10 hover:border-primary/20 transition-colors duration-500">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <div className="relative z-10 h-full">
        <SidebarContent collapsed={false} />
      </div>
    </div>
  );
}

/* ---------- Mobile Sidebar ---------- */
export function MobileSidebar() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="lg:hidden p-2">
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SidebarContent collapsed={false} />
      </SheetContent>
    </Sheet>
  );
}
