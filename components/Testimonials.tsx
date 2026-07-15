"use client";

import { useI18n } from "@/lib/i18n";

interface Testimonial {
  quote: string;
  name: string;
  context: string;
  avatar?: string;
}

interface TestimonialsProps {
  testimonials: Testimonial[];
  title?: string;
}

export function Testimonials({ 
  testimonials, 
  title,
}: TestimonialsProps) {
  const { t } = useI18n();
  const displayTitle = title ?? t('testimonials.title');
  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {displayTitle && (
        <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-8">
          {displayTitle}
        </h2>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map((testimonial, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col"
          >
            {/* Quote icon */}
            <svg 
              className="w-6 h-6 text-slate-700 mb-3" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            
            {/* Quote text */}
            <p className="text-sm text-slate-300 leading-relaxed flex-1 mb-4">
              "{testimonial.quote}"
            </p>
            
            {/* Attribution */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              {testimonial.avatar ? (
                <img
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm text-slate-400 font-medium">
                  {testimonial.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm text-white font-medium">{testimonial.name}</p>
                <p className="text-xs text-slate-500">{testimonial.context}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Placeholder testimonials for initial implementation
// NOTE: These placeholders use raw English strings. Callers should build
// localised testimonials via t('testimonials.quote1') etc. when possible.
export const PLACEHOLDER_TESTIMONIALS: Testimonial[] = [
  {
    quote: "Finally, an AI that doesn't just give me answers. It helped me realize I didn't actually understand recursion — I was just memorizing patterns.",
    name: "Alex",
    context: "Software Engineer",
  },
  {
    quote: "I passed my AWS certification on the first try. The difference was actually understanding the concepts instead of memorizing dump questions.",
    name: "Maria",
    context: "AWS Solutions Architect prep",
  },
  {
    quote: "As a homeschool parent, I can't be an expert in everything. Uncertain Systems fills the gaps and shows me exactly where my kids need help.",
    name: "Jennifer",
    context: "Homeschool parent of 3",
  },
];

/**
 * Build localised placeholder testimonials using `t()`.
 * Use this instead of PLACEHOLDER_TESTIMONIALS inside components.
 */
export function getLocalizedTestimonials(t: (key: string) => string): Testimonial[] {
  return [
    {
      quote: t('testimonials.quote1'),
      name: t('testimonials.name1'),
      context: t('testimonials.context1'),
    },
    {
      quote: t('testimonials.quote2'),
      name: t('testimonials.name2'),
      context: t('testimonials.context2'),
    },
    {
      quote: t('testimonials.quote3'),
      name: t('testimonials.name3'),
      context: t('testimonials.context3'),
    },
  ];
}
