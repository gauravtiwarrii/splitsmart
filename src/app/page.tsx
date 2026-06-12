import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  ArrowRight,
  Users,
  Receipt,
  Shield,
  Upload,
  TrendingUp,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Group Management",
    description: "Create groups, add members, and track shared expenses effortlessly.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Receipt,
    title: "Smart Splitting",
    description: "Split by equal, exact amounts, percentage, or shares — you choose.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: TrendingUp,
    title: "Real-time Balances",
    description: "See who owes whom instantly with simplified debt calculations.",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: Upload,
    title: "CSV Import Wizard",
    description: "Bulk import expenses with anomaly detection and guided review.",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Shield,
    title: "Audit Trail",
    description: "Full transparency with immutable audit logs and balance traces.",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: Sparkles,
    title: "Multi-Currency",
    description: "Support for INR and USD with automatic exchange rate handling.",
    gradient: "from-indigo-500 to-blue-500",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-border/40 glass">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
              SplitSmart
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="shadow-lg shadow-primary/25">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pt-24 pb-16 md:pt-32 md:pb-24 text-center">
        <div className="animate-slide-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            Premium Expense Splitting
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Split expenses,
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              not friendships
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            The modern way to manage shared expenses. Track, split, and settle group
            costs with a beautiful, intelligent dashboard.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="text-base shadow-xl shadow-primary/25 px-8">
                Start for Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="text-base px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero visual card */}
        <div className="mt-16 md:mt-20 relative">
          <div className="gradient-border glass rounded-2xl p-8 md:p-12 max-w-3xl mx-auto">
            <div className="grid grid-cols-3 gap-4 md:gap-8">
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold text-primary">₹2.4L</div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1">Total Tracked</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold text-emerald-400">12</div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1">Active Groups</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold text-teal-400">98%</div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1">Settled</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24 relative">
        <div className="premium-glow-bg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="text-center mb-12 relative z-10">
          <h2 className="text-3xl font-bold md:text-4xl">
            Everything you need to{" "}
            <span className="text-primary bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">manage expenses</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            From simple splits to complex multi-currency imports — SplitSmart handles it all.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 relative z-10">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group premium-card border-none rounded-2xl p-6"
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg mb-4`}
              >
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 relative">
        <div className="premium-card border-none rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
          <div className="premium-glow-bg -top-12 -right-12" />
          <div className="premium-glow-bg -bottom-12 -left-12" />
          <h2 className="text-2xl font-bold md:text-3xl mb-4 relative z-10">
            Ready to simplify your group expenses?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto relative z-10">
            Join thousands of groups who trust SplitSmart for transparent, hassle-free expense management.
          </p>
          <div className="relative z-10">
            <Link href="/signup">
              <Button size="lg" className="text-base shadow-xl shadow-primary/25 px-10">
                Get Started Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>© 2025 SplitSmart. Built with Next.js, Tailwind CSS, and ❤️</p>
      </footer>
    </div>
  );
}
