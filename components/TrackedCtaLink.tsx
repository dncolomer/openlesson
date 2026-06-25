"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackCtaClick } from "@/lib/analytics";

type TrackedCtaLinkProps = {
  href: string;
  label: string;
  location: string;
  page?: string;
  className?: string;
  children?: ReactNode;
};

export function TrackedCtaLink({
  href,
  label,
  location,
  page,
  className,
  children,
}: TrackedCtaLinkProps) {
  const handleClick = () => {
    trackCtaClick({ location, label, href, page });
  };

  if (href.startsWith("mailto:")) {
    return (
      <a href={href} onClick={handleClick} className={className}>
        {children ?? label}
      </a>
    );
  }

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children ?? label}
    </Link>
  );
}