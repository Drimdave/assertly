import { Sidebar } from "@/components/shell/sidebar"
import { Topbar } from "@/components/shell/topbar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh print:block print:h-auto">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground print:hidden"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col print:block">
        <Topbar />
        <main id="main" tabIndex={-1} className="relative flex-1 overflow-y-auto outline-none print:overflow-visible">{children}</main>
      </div>
    </div>
  )
}
