"use client"

import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toggleTheme } from "@/lib/theme"

export function ThemeToggle() {
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle light and dark theme" onClick={toggleTheme}>
      {/* Both icons render; CSS shows the right one, so there is no hydration mismatch */}
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  )
}
