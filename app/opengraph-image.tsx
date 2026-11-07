import { ImageResponse } from "next/og"

import { DEFECT_COUNT_WORD, SYSTEM_COUNT_TITLE } from "@/components/landing/counts"
import { siteUrl } from "@/lib/site"

/**
 * The picture shown when a link to the site is shared (chat, social, search). Drawn at build time from the same brand
 * mark and colours as the site, and the same words and counts as the front page. It names no hidden defect.
 */
export const alt = "Assertly: practice testing on software that has real bugs in it"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// The light theme's colours (app/globals.css), as hex because the image renderer wants hex
const INK = "#1a1d23"
const MUTED = "#5e6673"
const BLUE = "#2557d4"
const BLUE_SOFT = "#e7eefd"
const LINE = "#dcdfe4"
const STEPS = ["Requirements", "Test plan", "Test cases", "Bugs", "Summary"]

function Mark() {
  // The mark from components/brand/logo.tsx with its colours written out
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="15" fill={BLUE} />
      <g transform="translate(-2.25 0)">
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 31 L31 42 L51 22" fill="none" />
          <circle cx="21" cy="26.5" r="8.5" stroke="none" />
        </g>
        <g stroke={BLUE} strokeWidth="2.4" fill="none">
          <path d="M11.3 16.8 L30.7 36.2" />
          <path d="M30.7 16.8 L11.3 36.2" />
        </g>
      </g>
    </svg>
  )
}

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: "60px 72px", borderTop: `14px solid ${BLUE}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Mark />
            <div style={{ display: "flex", marginLeft: 20, fontSize: 44, fontWeight: 700, color: INK, letterSpacing: -1 }}>Assertly</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED }}>{siteUrl().host}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 78, fontWeight: 700, color: INK, lineHeight: 1.06, letterSpacing: -2, maxWidth: 1000 }}>
            Practice testing on software that has real bugs in it
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 31, color: MUTED, lineHeight: 1.35, maxWidth: 930 }}>
            {`${SYSTEM_COUNT_TITLE} small systems, ${DEFECT_COUNT_WORD} hidden defects in each. You are scored on the ones you actually find.`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {STEPS.map((step, i) => (
              <div key={step} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ display: "flex", width: 22, height: 2, background: LINE, margin: "0 10px" }} />}
                <div style={{ display: "flex", background: BLUE_SOFT, color: BLUE, fontSize: 24, fontWeight: 600, padding: "8px 16px", borderRadius: 6 }}>{step}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
