import Image from "next/image";
import { BRAND_LOGO_PATH } from "@/lib/brand";

type BrandLogoProps = {
  size?: number;
  name?: string;
  showName?: boolean;
  className?: string;
  nameClassName?: string;
};

export function BrandLogo({
  size = 28,
  name = "Uncertain Systems",
  showName = true,
  className = "",
  nameClassName = "text-base font-semibold tracking-tight text-white",
}: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src={BRAND_LOGO_PATH}
        alt={name}
        width={size}
        height={size}
        className="rounded-sm object-contain"
        priority
      />
      {showName ? <span className={nameClassName}>{name}</span> : null}
    </span>
  );
}