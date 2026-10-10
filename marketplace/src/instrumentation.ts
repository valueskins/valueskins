// Runs once when a server process starts (Next.js instrumentation hook).
// Its only job is to start error reporting on the Node.js server.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
}
