import Link from "next/link"

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-1 text-heading-lg tracking-tight">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">That page does not exist or has moved.</p>
        <Link href="/app" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to your workspace
        </Link>
      </div>
    </div>
  )
}
