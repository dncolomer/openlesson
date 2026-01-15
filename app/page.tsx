"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { Hero, HowItWorks, Features, Footer } from "@/components/landing";
import { Button, Container } from "@/components/ui";

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-[var(--color-sand)]/50">
      <Container>
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-indigo)] flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-semibold text-[var(--color-charcoal)]">
              OpenLesson
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              href="#how-it-works" 
              className="text-sm text-[var(--color-graphite)] hover:text-[var(--color-charcoal)] transition-colors"
            >
              How It Works
            </Link>
            <Link 
              href="#features" 
              className="text-sm text-[var(--color-graphite)] hover:text-[var(--color-charcoal)] transition-colors"
            >
              Features
            </Link>
          </nav>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </header>
  );
}

function CTA() {
  return (
    <section className="py-24 bg-[var(--color-indigo)]">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-4">
            Ready to Start Learning?
          </h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
            Join OpenLesson today and discover a smarter way to learn any topic
          </p>
          <Link href="/register">
            <Button 
              size="lg" 
              className="bg-white text-[var(--color-indigo)] hover:bg-[var(--color-ivory)]"
            >
              Create Free Account
            </Button>
          </Link>
        </motion.div>
      </Container>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
