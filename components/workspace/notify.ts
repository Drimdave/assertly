import { toast } from "sonner"

import { workspace } from "@/lib/workspace/store"

/** Shows a toast with an Undo action that reverts the last workspace change. */
export function notifyUndo(message: string) {
  toast(message, { action: { label: "Undo", onClick: () => workspace.undo() } })
}
