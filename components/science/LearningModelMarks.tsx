import { AccelerandoMark } from "@/components/AccelerandoGlyphs";
import {
  LEARNING_MODEL_CATALOG_4,
  LEARNING_MODEL_CATALOG_16,
  LEARNING_MODEL_OBJECTS,
} from "@/lib/learning-model";
import { cn } from "@/lib/utils";

const CONCEPT_MARK: Record<string, string> = Object.fromEntries(
  LEARNING_MODEL_OBJECTS.map((row) => [row.id, row.name]),
);

const ACTION_MARK: Record<string, string> = Object.fromEntries(
  [...LEARNING_MODEL_CATALOG_4, ...LEARNING_MODEL_CATALOG_16].map((row) => [row.id, row.label]),
);

const MODE_MARK: Record<string, string> = {
  calibrate: "Calibrate",
  learn: "Learn",
  verify: "Verify",
};

const MARK_CLASS = "absolute inset-[15%] size-auto text-[#b0d6be]";

export function LearningModelObjectGlyph({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  return (
    <AccelerandoMark
      text={CONCEPT_MARK[id] ?? "Hidden state"}
      className={cn(MARK_CLASS, className)}
    />
  );
}

export function LearningModelActionGlyph({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  return <AccelerandoMark text={ACTION_MARK[id] ?? "Forage"} className={cn(MARK_CLASS, className)} />;
}

export function LearningModelModeGlyph({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  return <AccelerandoMark text={MODE_MARK[id] ?? "Learn"} className={cn(MARK_CLASS, className)} />;
}
