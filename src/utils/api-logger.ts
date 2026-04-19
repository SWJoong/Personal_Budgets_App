export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    console.log(`[API] ${label} ${Date.now() - start}ms OK`)
    return result
  } catch (e) {
    console.error(`[API] ${label} ${Date.now() - start}ms ERR`, e)
    throw e
  }
}
