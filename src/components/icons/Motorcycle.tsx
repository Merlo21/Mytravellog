import { forwardRef } from "react";
import type { SVGProps } from "react";

/**
 * Lucide non ha un'icona moto dedicata — disegnata a mano nello stesso stile
 * (viewBox 24x24, stroke=currentColor, round cap/join) per essere
 * intercambiabile con le icone lucide ovunque venga usata come React.ElementType.
 */
export const Motorcycle = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  ({ width = 24, height = 24, stroke = "currentColor", strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="5" cy="17" r="3" />
      <circle cx="19" cy="17" r="3" />
      <path d="M5 17 9 10h5l5 7" />
      <path d="M9 10 11 6h4" />
      <path d="M14 10 16 7" />
    </svg>
  )
);
Motorcycle.displayName = "Motorcycle";
