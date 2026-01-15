"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Sparkles, BookOpen, Brain } from "lucide-react";
import { Button, Container } from "@/components/ui";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-cream)] via-[var(--color-ivory)] to-[var(--color-cream)]" />
      
      {/* Floating decorative elements */}
      <motion.div
        className="absolute top-32 left-[10%] w-64 h-64 rounded-full bg-[var(--color-indigo)]/5 blur-3xl"
        animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-32 right-[10%] w-80 h-80 rounded-full bg-[var(--color-emerald)]/5 blur-3xl"
        animate={{ y: [0, 20, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Hand-drawn style decorative circles */}
      <svg
        className="absolute top-40 right-[20%] w-24 h-24 text-[var(--color-indigo)]/10"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" strokeDasharray="8 4" />
      </svg>
      <svg
        className="absolute bottom-40 left-[15%] w-16 h-16 text-[var(--color-emerald)]/20"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="3" />
      </svg>

      <Container size="xl" className="relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-indigo)]/10 text-[var(--color-indigo)] text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              AI-Powered Adaptive Learning
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-[1.1] mb-6">
              Learn Any Topic Through{" "}
              <span className="gradient-text">Challenges</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-[var(--color-stone)] max-w-xl mx-auto lg:mx-0 mb-8">
              Generate personalized lesson plans with AI. Master any subject through 
              adaptive challenges that evolve based on your progress.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/dashboard/plans/new">
                <Button size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>
                  Start Learning
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="secondary" size="lg">
                  See How It Works
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="mt-10 flex items-center gap-6 justify-center lg:justify-start text-sm text-[var(--color-stone)]"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[var(--color-indigo)]" />
                <span>Any topic</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[var(--color-emerald)]" />
                <span>AI-evaluated</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            className="relative"
          >
            {/* Card mockup */}
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Shadow */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[80%] h-8 bg-black/10 blur-2xl rounded-full" />
              
              {/* Main card */}
              <motion.div
                className="relative bg-white rounded-2xl p-6 shadow-2xl"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Challenge preview */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-indigo)]/10 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-[var(--color-indigo)]" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-pebble)]">Challenge 3 of 8</p>
                      <p className="font-semibold text-[var(--color-charcoal)]">Machine Learning Basics</p>
                    </div>
                  </div>
                  
                  <div className="bg-[var(--color-ivory)] rounded-xl p-4">
                    <p className="text-sm text-[var(--color-graphite)]">
                      Explain the difference between supervised and unsupervised learning. 
                      Provide an example use case for each.
                    </p>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--color-stone)]">Progress</span>
                      <span className="font-medium text-[var(--color-indigo)]">37%</span>
                    </div>
                    <div className="h-2 bg-[var(--color-sand)] rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-[var(--color-indigo)] rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: "37%" }}
                        transition={{ delay: 1, duration: 1, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                  
                  {/* Animated typing indicator */}
                  <div className="flex items-center gap-2 text-sm text-[var(--color-emerald)]">
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="flex items-center gap-1"
                    >
                      <div className="w-2 h-2 bg-[var(--color-emerald)] rounded-full" />
                      <span>AI ready to evaluate</span>
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              {/* Floating badge */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="absolute -bottom-4 -right-4 bg-[var(--color-emerald)] text-white rounded-xl shadow-lg px-4 py-3"
              >
                <p className="text-xs font-medium">Instant Feedback</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
