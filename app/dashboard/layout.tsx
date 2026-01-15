"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/hooks";
import { Container, Button } from "@/components/ui";
import { 
  BookOpen, 
  LayoutDashboard, 
  BookText, 
  BarChart3, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/plans", label: "My Plans", icon: BookText },
  { href: "/dashboard/progress", label: "Progress", icon: BarChart3 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useUser();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[var(--color-sand)]">
        <Container size="xl">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-indigo)] flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-semibold text-[var(--color-charcoal)]">
                OpenLesson
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[var(--color-indigo)]/10 text-[var(--color-indigo)]"
                        : "text-[var(--color-graphite)] hover:bg-[var(--color-ivory)]"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User menu */}
            <div className="flex items-center gap-4">
              <Link href="/dashboard/plans/new">
                <Button size="sm" className="hidden sm:flex">
                  New Plan
                </Button>
              </Link>
              <button
                onClick={handleSignOut}
                className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-graphite)] hover:text-[var(--color-charcoal)] transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-[var(--color-graphite)]"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </Container>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--color-sand)] bg-white">
            <Container>
              <nav className="py-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-[var(--color-indigo)]/10 text-[var(--color-indigo)]"
                          : "text-[var(--color-graphite)] hover:bg-[var(--color-ivory)]"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
                <Link
                  href="/dashboard/plans/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[var(--color-indigo)] hover:bg-[var(--color-indigo)]/10"
                >
                  <BookText className="w-5 h-5" />
                  Create New Plan
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[var(--color-graphite)] hover:bg-[var(--color-ivory)] w-full"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </nav>
            </Container>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="py-8">
        <Container size="xl">
          {children}
        </Container>
      </main>
    </div>
  );
}
