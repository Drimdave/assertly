"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { MAX_TAGS, normalizeTag, TAG_MAX_LENGTH } from "@/lib/workspace/schema"

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  id?: string
  placeholder?: string
  className?: string
}

/** Chip input: Enter or comma adds a tag, Backspace on an empty field removes the last one. */
export function TagInput({ value, onChange, id, placeholder = "Add tag", className }: TagInputProps) {
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    const tag = normalizeTag(draft).slice(0, TAG_MAX_LENGTH)
    if (tag && !value.includes(tag) && value.length < MAX_TAGS) onChange([...value, tag])
    setDraft("")
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex min-h-8 w-full flex-wrap items-center gap-1.5 rounded-sm border border-input bg-background px-1.5 py-1 focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      {value.map((tag) => (
        <span key={tag} className="inline-flex h-6 items-center gap-0.5 rounded-[4px] bg-primary-soft pl-2 pr-0.5 text-xs font-medium text-primary">
          {tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            onClick={(e) => {
              e.stopPropagation()
              onChange(value.filter((t) => t !== tag))
            }}
            className="grid h-5 w-5 place-items-center rounded-[3px] hover:bg-primary/15"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(",", ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            commit()
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={value.length >= MAX_TAGS ? "" : placeholder}
        disabled={value.length >= MAX_TAGS}
        className="h-6 min-w-20 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
