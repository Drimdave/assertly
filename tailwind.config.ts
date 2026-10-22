import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
        },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        subtle: "hsl(var(--subtle))",
        raised: "hsl(var(--surface-raised))",
        success: { DEFAULT: "hsl(var(--success))", soft: "hsl(var(--success-soft))" },
        warning: { DEFAULT: "hsl(var(--warning))", soft: "hsl(var(--warning-soft))" },
        danger: { DEFAULT: "hsl(var(--danger))", soft: "hsl(var(--danger-soft))" },
        neutral: { soft: "hsl(var(--neutral-soft))" },
      },
      // Radius scale: 4px controls (sm), 6px (md), 8px panels/popovers (lg). Full rounding only for avatars.
      // Type scale (size / line height), after the Atlassian foundations: headings bold, body regular.
      fontSize: {
        "heading-xl": ["1.75rem", { lineHeight: "2rem", fontWeight: "700" }],
        "heading-lg": ["1.5rem", { lineHeight: "1.75rem", fontWeight: "700" }],
        "heading-md": ["1.25rem", { lineHeight: "1.5rem", fontWeight: "700" }],
        "heading-sm": ["1rem", { lineHeight: "1.25rem", fontWeight: "700" }],
        "heading-xs": ["0.875rem", { lineHeight: "1.25rem", fontWeight: "700" }],
        "heading-xxs": ["0.75rem", { lineHeight: "1rem", fontWeight: "700" }],
        "metric-lg": ["1.75rem", { lineHeight: "2rem", fontWeight: "700" }],
        "metric-md": ["1.5rem", { lineHeight: "1.75rem", fontWeight: "700" }],
        "metric-sm": ["1rem", { lineHeight: "1.25rem", fontWeight: "700" }],
        "body-lg": ["1rem", { lineHeight: "1.5rem" }],
      },
      // Elevation: sunken (bg-subtle) / default / raised (movable cards) / overlay (drawers, menus, dialogs)
      boxShadow: {
        raised: "var(--shadow-raised)",
        overlay: "var(--shadow-overlay)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        // The ring around whatever the tour is pointing at: a soft pulse outward
        "tour-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--primary) / 0.55)" },
          "60%": { boxShadow: "0 0 0 8px hsl(var(--primary) / 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "tour-pulse": "tour-pulse 1.8s ease-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
export default config
