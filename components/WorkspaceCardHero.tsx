import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { resolveWorkspaceCoverImage } from "@/lib/workspace-visual";
import { WorkspaceAbstractArt } from "@/components/WorkspaceAbstractArt";

type WorkspaceCardHeroProps = {
  workspaceId: string;
  coverImageUrl?: string | null;
  /** Use aesthetic fallback when no stored cover (catalog cards). Default: abstract vector art. */
  fallback?: "aesthetic" | "abstract";
  heightClassName?: string;
  badges?: ReactNode;
  className?: string;
  imageClassName?: string;
};

export function WorkspaceCardHero({
  workspaceId,
  coverImageUrl,
  fallback = "abstract",
  heightClassName = "h-40",
  badges,
  className,
  imageClassName,
}: WorkspaceCardHeroProps) {
  const hasStoredCover = Boolean(coverImageUrl?.trim());
  const imageSrc =
    fallback === "aesthetic"
      ? resolveWorkspaceCoverImage(workspaceId, coverImageUrl)
      : hasStoredCover
        ? coverImageUrl!.trim()
        : null;

  return (
    <div className={cn("relative overflow-hidden bg-neutral-950", heightClassName, className)}>
      {imageSrc ? (
        <div
          className={cn(
            "absolute inset-0 scale-105 bg-cover bg-center transition duration-500 group-hover:scale-110",
            imageClassName,
          )}
          style={{ backgroundImage: `url(${imageSrc})` }}
          role="img"
          aria-label=""
        />
      ) : (
        <WorkspaceAbstractArt seed={workspaceId} className="absolute inset-0 transition duration-500 group-hover:scale-[1.03]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
      {badges ? <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">{badges}</div> : null}
    </div>
  );
}