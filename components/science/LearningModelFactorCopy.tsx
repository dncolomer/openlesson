import { Fragment } from "react";
import { splitFactorColoredParts } from "@/lib/science/learning-model-copy";

export function LearningModelFactorCopy({ text }: { text: string }) {
  return (
    <>
      {splitFactorColoredParts(text).map((part, index) =>
        part.color ? (
          <span
            key={index}
            data-learning-model-factor-name={part.text}
            style={{ color: part.color }}
          >
            {part.text}
          </span>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
