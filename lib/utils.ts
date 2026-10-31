import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge our custom type-scale classes (tailwind.config.ts). Without this it would treat
// `text-heading-md` or `text-metric-lg` as a text *color* and drop them when a color class is added.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "display-sm",
            "heading-xl",
            "heading-lg",
            "heading-md",
            "heading-sm",
            "heading-xs",
            "heading-xxs",
            "metric-lg",
            "metric-md",
            "metric-sm",
            "body-lg",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
