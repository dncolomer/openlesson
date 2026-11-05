import { cn } from "@/lib/utils";

const MARK_CLASS = "absolute inset-[22%] size-auto border border-current text-[#b0d6be]";

function SimpleMark({ className }: { className?: string }) {
  return <span aria-hidden className={cn(MARK_CLASS, className)} />;
}

export function LearningModelObjectGlyph({
  className,
}: {
  id: string;
  className?: string;
}) {
  return <SimpleMark className={className} />;
}

export function LearningModelActionGlyph({
  className,
}: {
  id: string;
  className?: string;
}) {
  return <SimpleMark className={className} />;
}

export function LearningModelModeGlyph({
  className,
}: {
  id: string;
  className?: string;
}) {
  return <SimpleMark className={className} />;
}
