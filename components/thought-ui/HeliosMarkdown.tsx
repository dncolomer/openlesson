"use client";

import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { processHeliosMarkdown } from "@/lib/helios-markdown";
import { IleWordBoxText } from "@/components/thought-ui/IleWordBoxText";
import type { IleWordBoxMenuAction } from "@/lib/ile-word-boxes";
import { cn } from "@/lib/utils";

function wrapMarkdownTextNodes(
  children: ReactNode,
  onOpenTool?: (action: IleWordBoxMenuAction) => void,
): ReactNode {
  if (!onOpenTool) return children;
  return Children.map(children, (child, index) => {
    if (typeof child === "string" || typeof child === "number") {
      const text = String(child);
      if (!text) return child;
      return (
        <IleWordBoxText
          key={`wb-${index}`}
          text={text}
          onOpenTool={onOpenTool}
        />
      );
    }
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children != null) {
      return cloneElement(child, {
        children: wrapMarkdownTextNodes(child.props.children, onOpenTool),
      });
    }
    return child;
  });
}

function withWordBoxes(
  node: ReactNode,
  onOpenWordBoxTool?: (action: IleWordBoxMenuAction) => void,
): ReactNode {
  return wrapMarkdownTextNodes(node, onOpenWordBoxTool);
}

export function HeliosMarkdown({
  children,
  className,
  onOpenWordBoxTool,
}: {
  children: string;
  className?: string;
  onOpenWordBoxTool?: (action: IleWordBoxMenuAction) => void;
}) {
  const markdownComponents: Components = {
    a: ({ href, children: inner, ...props }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-neutral-100 underline underline-offset-2 hover:text-white"
        {...props}
      >
        {inner}
      </a>
    ),
    p: ({ children: inner }) => (
      <p className="my-2 first:mt-0 last:mb-0">{withWordBoxes(inner, onOpenWordBoxTool)}</p>
    ),
    h1: ({ children: inner }) => (
      <h1 className="mb-1.5 mt-3 text-[1.05em] font-semibold first:mt-0">
        {withWordBoxes(inner, onOpenWordBoxTool)}
      </h1>
    ),
    h2: ({ children: inner }) => (
      <h2 className="mb-1.5 mt-3 text-[1.02em] font-semibold first:mt-0">
        {withWordBoxes(inner, onOpenWordBoxTool)}
      </h2>
    ),
    h3: ({ children: inner }) => (
      <h3 className="mb-1 mt-2.5 text-[1em] font-semibold first:mt-0">
        {withWordBoxes(inner, onOpenWordBoxTool)}
      </h3>
    ),
    ul: ({ children: inner }) => (
      <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{inner}</ul>
    ),
    ol: ({ children: inner }) => (
      <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{inner}</ol>
    ),
    li: ({ children: inner }) => (
      <li className="leading-relaxed">{withWordBoxes(inner, onOpenWordBoxTool)}</li>
    ),
    blockquote: ({ children: inner }) => (
      <blockquote className="my-2 border-l-2 border-white/25 pl-3 text-neutral-300 first:mt-0 last:mb-0">
        {withWordBoxes(inner, onOpenWordBoxTool)}
      </blockquote>
    ),
    hr: () => <hr className="my-3 border-white/15" />,
    strong: ({ children: inner }) => (
      <strong className="font-semibold text-neutral-50">
        {withWordBoxes(inner, onOpenWordBoxTool)}
      </strong>
    ),
    em: ({ children: inner }) => (
      <em className="italic text-neutral-100">{withWordBoxes(inner, onOpenWordBoxTool)}</em>
    ),
    pre: ({ children: inner }) => (
      <pre className="my-3 overflow-x-auto rounded-none border border-white/10 bg-black/45 p-3 text-left text-[0.85em] leading-relaxed first:mt-0 last:mb-0">
        {inner}
      </pre>
    ),
    code: ({ className: codeClass, children: inner, ...props }) => {
      const isFence = Boolean(codeClass && /language-/.test(codeClass));
      if (isFence) {
        return (
          <code className={cn("font-mono", codeClass)} {...props}>
            {inner}
          </code>
        );
      }
      return (
        <code
          className="rounded-none bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-neutral-100"
          {...props}
        >
          {inner}
        </code>
      );
    },
    table: ({ children: inner }) => (
      <div className="my-3 overflow-x-auto first:mt-0 last:mb-0">
        <table className="w-full border-collapse text-left text-[0.9em]">{inner}</table>
      </div>
    ),
    thead: ({ children: inner }) => <thead className="text-neutral-50">{inner}</thead>,
    th: ({ children: inner }) => (
      <th className="border-b border-white/20 px-2 py-1 font-semibold">
        {withWordBoxes(inner, onOpenWordBoxTool)}
      </th>
    ),
    td: ({ children: inner }) => (
      <td className="border-b border-white/10 px-2 py-1 align-top">
        {withWordBoxes(inner, onOpenWordBoxTool)}
      </td>
    ),
  };

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
