import Image from "next/image";
import { GYM_NAME } from "@/lib/branding";

export function GymLogo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/golds-gym-logo.png"
      alt={`${GYM_NAME} logo`}
      width={size}
      height={size}
      className={className}
      preload
    />
  );
}
