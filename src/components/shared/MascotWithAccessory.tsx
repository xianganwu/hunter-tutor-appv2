"use client";

import { Mascot, type MascotAnimal } from "./Mascot";
import { AccessoryOverlay } from "./MascotAccessories";
import type { MascotAccessory } from "@/lib/achievements";

interface MascotWithAccessoryProps {
  readonly tier?: 1 | 2 | 3 | 4 | 5;
  readonly size?: "sm" | "md" | "lg" | "xl";
  readonly mascotType?: MascotAnimal;
  readonly accessory?: MascotAccessory;
  readonly className?: string;
}

export function MascotWithAccessory({
  tier = 1,
  size = "md",
  mascotType = "penguin",
  accessory = "none",
  className = "",
}: MascotWithAccessoryProps) {
  return (
    <span className={`relative inline-block ${className}`}>
      <Mascot tier={tier} size={size} mascotType={mascotType} />
      {accessory !== "none" && (
        <span className="absolute inset-0">
          <AccessoryOverlay accessory={accessory} mascotType={mascotType} />
        </span>
      )}
    </span>
  );
}
