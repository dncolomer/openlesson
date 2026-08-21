"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { processHeliosMarkdown } from "@/lib/helios-markdown";
import { cn } from "@/lib/utils";

const markdownComponents: Components = {
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-neutral-100 underline underline-offset-2 hover:text-white"
      {...props}
    >
      {children}
    </a>
  ),
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h1 className="mb-1.5 mt-3 text-[1.05em] font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-[1.02em] font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2.5 text-[1em] font-semibold first:mt-0">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-white/25 pl-3 text-neutral-300 first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-white/15" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-neutral-50">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-neutral-100">{children}</em>,
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-none border border-white/10 bg-black/45 p-3 text-left text-[0.85em] leading-relaxed first:mt-0 last:mb-0">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isFence = Boolean(className && /language-/.test(className));
    if (isFence) {
      return (
        <code className={cn("font-mono", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-none bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-neutral-100"
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto first:mt-0 last:mb-0">
      <table className="w-full border-collapse text-left text-[0.9em]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="text-neutral-50">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-white/20 px-2 py-1 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-white/10 px-2 py-1 align-top">{children}</td>
  ),
};

export function HeliosMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      data-helios-markdown
      className={cn(
        "helios-markdown max-w-none text-left [&_.katex]:text-inherit",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={markdownComponents}
      >
        {processHeliosMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}
