/**
 * Cross-environment fetch utility.
 *
 * In a browser/web context (dev:web), we use the native browser `fetch`.
 * In Tauri desktop, we prefer native fetch too, but fall back to the Tauri
 * HTTP plugin which can bypass CORS restrictions.
 */

const isTauri =
    typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__

let _tauriFetch: typeof globalThis.fetch | null = null

async function getTauriFetch(): Promise<typeof globalThis.fetch> {
    if (!_tauriFetch) {
        try {
            const mod = await import("@tauri-apps/plugin-http")
            _tauriFetch = mod.fetch as unknown as typeof globalThis.fetch
        } catch {
            // Not running in Tauri, fall back to native fetch
            _tauriFetch = globalThis.fetch.bind(globalThis)
        }
    }
    return _tauriFetch!
}

export async function httpFetch(
    input: string | URL | Request,
    init?: RequestInit
): Promise<Response> {
    if (isTauri) {
        // In Tauri, try native fetch first (fast path), then plugin as fallback
        try {
            const res = await globalThis.fetch(input, init)
            if (res.ok || res.status === 304) return res
        } catch {
            // fall through to Tauri plugin
        }
        const tauriFetch = await getTauriFetch()
        return tauriFetch(input as any, init as any)
    }

    // Plain browser environment
    return globalThis.fetch(input, init)
}
