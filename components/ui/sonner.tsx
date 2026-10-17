"use client"

import { useResolvedTheme } from "@/hooks/use-theme"
import { Toaster as Sonner, type ToasterProps } from "sonner"

export function Toaster(props: ToasterProps) {
  const theme = useResolvedTheme()
  return (
    <Sonner
      theme={theme}
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[356px] max-w-[calc(100vw-2rem)] items-center gap-3 rounded-md bg-foreground py-2 pl-4 pr-2 text-sm text-background shadow-xl",
          title: "flex-1",
          actionButton: "rounded-sm px-2 py-0.5 font-medium underline underline-offset-2 hover:opacity-80",
        },
      }}
      {...props}
    />
  )
}
