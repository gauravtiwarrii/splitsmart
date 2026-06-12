import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Full-width Top Header */}
      <Navbar />

      {/* Centered Main Workspace (Splitwise Style) */}
      <div className="w-full max-w-5xl mx-auto px-4 py-6 flex-1 flex flex-col md:flex-row gap-6">
        {/* Left Sidebar Navigation */}
        <aside className="w-full md:w-56 shrink-0">
          <Sidebar />
        </aside>

        {/* Center Main Content Area */}
        <main className="flex-1 min-w-0 bg-card border border-border/80 rounded-xl p-4 shadow-sm md:p-6 relative">
          <div className="premium-glow-bg opacity-20 pointer-events-none absolute -top-40 -left-40" />
          <div className="relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
