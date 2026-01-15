"use client";

import { motion } from "framer-motion";
import { 
  Brain, 
  Zap, 
  BarChart3, 
  MessageSquare, 
  RefreshCw, 
  Shield 
} from "lucide-react";
import { Container, Card } from "@/components/ui";

const features = [
  {
    icon: Brain,
    title: "AI-Generated Plans",
    description: "Our AI creates comprehensive lesson plans tailored to your learning goals and current skill level.",
  },
  {
    icon: Zap,
    title: "Instant Feedback",
    description: "Get detailed, constructive feedback on every submission within seconds, not hours.",
  },
  {
    icon: BarChart3,
    title: "Adaptive Difficulty",
    description: "Challenges automatically adjust based on your performance. Struggling? We slow down. Excelling? We push harder.",
  },
  {
    icon: MessageSquare,
    title: "Clear Success Criteria",
    description: "Know exactly what's expected. Each challenge comes with clear criteria for what constitutes a passing answer.",
  },
  {
    icon: RefreshCw,
    title: "Plan Recomputation",
    description: "Your learning path evolves with you. AI recomputes future challenges based on your demonstrated knowledge.",
  },
  {
    icon: Shield,
    title: "Progress Tracking",
    description: "Monitor your journey with detailed statistics. See your growth over time across all topics.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-[var(--color-ivory)]">
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
            Everything You Need to Learn
          </h2>
          <p className="text-lg text-[var(--color-stone)] max-w-2xl mx-auto">
            Powered by advanced AI to give you the most effective learning experience
          </p>
        </motion.div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card hover padding="lg" className="h-full">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-indigo)]/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-[var(--color-indigo)]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-2">
                  {feature.title}
                </h3>
                <p className="text-[var(--color-stone)] leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
