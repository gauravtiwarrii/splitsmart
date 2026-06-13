import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-transparent flex flex-col relative">
      <div className="bg-mesh" />
      {/* Full-width Top Header */}
      <Navbar />

      {/* Fluid Main Workspace */}
      <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16 py-8 flex-1 flex flex-col md:flex-row gap-8 lg:gap-12 relative z-10">
        {/* Left Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0">
          <Sidebar />
        </aside>

        {/* Center Main Content Area */}
        <main className="flex-1 min-w-0 premium-card p-4 md:p-8">
          <div className="relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
