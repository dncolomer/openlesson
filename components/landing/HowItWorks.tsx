"use client";

import { motion } from "framer-motion";
import { Lightbulb, Target, TrendingUp } from "lucide-react";
import { Container } from "@/components/ui";

const steps = [
  {
    icon: Lightbulb,
    title: "Enter Your Topic",
    description: "Tell us what you want to learn. From programming to history, physics to creative writing — any subject works.",
    color: "var(--color-indigo)",
  },
  {
    icon: Target,
    title: "Complete Challenges",
    description: "Work through AI-generated challenges designed to build your understanding step by step. Get instant, detailed feedback.",
    color: "var(--color-emerald)",
  },
  {
    icon: TrendingUp,
    title: "Track Progress",
    description: "Watch your knowledge grow as the AI adapts to your skill level. Challenges evolve based on your performance.",
    color: "var(--color-info)",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-white">
      <Container>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-semibold text-[var(--color-charcoal)] mb-4">
            How It Works
          </h2>
          <p className="text-lg text-[var(--color-stone)] max-w-2xl mx-auto">
            Start learning in minutes with our simple three-step process
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="relative"
            >
              {/* Connector line (hidden on last item) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-full h-[2px] bg-[var(--color-sand)]" />
              )}
              
              <div className="relative bg-[var(--color-cream)] rounded-2xl p-8 text-center">
                {/* Step number */}
                <div 
                  className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: step.color }}
                >
                  {index + 1}
                </div>
                
                {/* Icon */}
                <div 
                  className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${step.color}15` }}
                >
                  <step.icon 
                    className="w-8 h-8" 
                    style={{ color: step.color }}
                  />
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-semibold text-[var(--color-charcoal)] mb-3">
                  {step.title}
                </h3>
                <p className="text-[var(--color-stone)] leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
