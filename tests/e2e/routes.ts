// One list, used by the dev-server console test and by the warm-up that precedes it, so a new page is
// compiled before the tests start instead of during them (a cold compile under load can exceed a test timeout).
export const CONSOLE_ROUTES = ["/app", "/learn", "/learn/email", "/app/novabank/requirements", "/app/novabank/plan", "/app/novabank/sessions", "/app/novabank/bugs", "/sandbox/novabank", "/sign-in", "/sign-up", "/app/novabank/cases", "/app/novabank/board", "/app/novabank/report"]
