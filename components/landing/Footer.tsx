"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Container } from "@/components/ui";

export function Footer() {
  return (
    <footer className="py-12 bg-[var(--color-charcoal)] text-white">
      <Container>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-indigo)] flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-semibold">OpenLesson</span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-8 text-sm text-[var(--color-pebble)]">
            <Link href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </Link>
            <Link href="#features" className="hover:text-white transition-colors">
              Features
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Sign In
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-sm text-[var(--color-stone)]">
            © {new Date().getFullYear()} OpenLesson
          </p>
        </div>
      </Container>
    </footer>
  );
}
