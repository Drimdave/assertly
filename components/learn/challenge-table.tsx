"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLearnState } from "@/hooks/use-learn-state"
import { CATEGORIES, CHALLENGES, type Difficulty } from "@/lib/learn/challenges"
import { challengeProgress, overallProgress } from "@/lib/learn/progress"
import { resetAll } from "@/lib/learn/store"

export const DIFFICULTY_TONE: Record<Difficulty, NonNullable<LozengeProps["tone"]>> = {
  Easy: "success",
  Medium: "warning",
  Hard: "danger",
}

export function ChallengeTable() {
  const state = useLearnState()
  const router = useRouter()
  const [category, setCategory] = useState("all")
  const [difficulty, setDifficulty] = useState("all")

  const rows = CHALLENGES.filter(
    (c) => (category === "all" || c.category === category) && (difficulty === "all" || c.difficulty === difficulty),
  )
  const overall = overallProgress(state)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-auto gap-3" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Category: All</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger className="w-auto gap-3" aria-label="Filter by difficulty">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Difficulty: All</SelectItem>
            {(["Easy", "Medium", "Hard"] as const).map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {rows.length} of {CHALLENGES.length} · {overall.completed} complete
        </span>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              Reset progress
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all Fundamentals progress?</AlertDialogTitle>
              <AlertDialogDescription>
                This clears every discovered scenario and attempt count stored in this browser. It cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={resetAll}>Reset progress</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Key</TableHead>
              <TableHead>Challenge</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead className="hidden sm:table-cell">Category</TableHead>
              <TableHead>Scenarios</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No challenges match these filters.{" "}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => {
                      setCategory("all")
                      setDifficulty("all")
                    }}
                  >
                    Clear filters
                  </button>
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => {
              const p = challengeProgress(c.slug, state)
              const href = `/learn/${c.slug}`
              return (
                <TableRow key={c.slug} className="cursor-pointer" onClick={() => router.push(href)}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{c.code}</TableCell>
                  <TableCell className="min-w-40">
                    <Link href={href} className="font-medium hover:text-primary hover:underline">
                      {c.title}
                    </Link>
                    <span className="ml-2 hidden text-muted-foreground xl:inline">{c.description}</span>
                  </TableCell>
                  <TableCell>
                    <Lozenge tone={DIFFICULTY_TONE[c.difficulty]}>{c.difficulty}</Lozenge>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{c.category}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className="h-full bg-primary" style={{ width: `${(p.found / p.total) * 100}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {p.found}/{p.total}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Lozenge tone={p.completed ? "success" : p.found > 0 ? "info" : "neutral"}>
                      {p.completed ? "Complete" : p.found > 0 ? "In progress" : "Not started"}
                    </Lozenge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
