export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startOtelIfConfigured } = await import("./instrumentation-otel");
    await startOtelIfConfigured();
  }
}
