import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Container } from "@/components/ui";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-cream)] flex flex-col">
      {/* Header */}
      <header className="py-6">
        <Container>
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-indigo)] flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-semibold text-[var(--color-charcoal)]">
              OpenLesson
            </span>
          </Link>
        </Container>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6">
        <Container>
          <p className="text-center text-sm text-[var(--color-stone)]">
            © {new Date().getFullYear()} OpenLesson. All rights reserved.
          </p>
        </Container>
      </footer>
    </div>
  );
}
