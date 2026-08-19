import type { ButtonHTMLAttributes } from "react";
import {
  thoughtButtonClasses,
  type ThoughtButtonSize,
  type ThoughtButtonVariant,
} from "@/lib/tap-score-client-helpers";

export function TapThoughtButton({
  size = "md",
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ThoughtButtonSize;
  variant?: ThoughtButtonVariant;
}) {
  return <button className={thoughtButtonClasses({ size, variant, className })} {...props} />;
}
