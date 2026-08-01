import { defineConfig } from "vite"
import { sveltekit } from "@sveltejs/kit/vite"

const host = process.env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    plugins: [sveltekit()],

    define: {
        __PROJECT_PATH__: JSON.stringify(process.cwd()),
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1337,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                  protocol: "ws",
                  host,
                  port: 1338,
              }
            : undefined,
        proxy: {
            "/splice-api": {
                target: "https://surfaces-graphql.splice.com",
                changeOrigin: true,
                rewrite: (/** @type {string} */ path) => path.replace(/^\/splice-api/, ""),
                configure: (/** @type {any} */ proxy) => {
                    proxy.on("proxyReq", (/** @type {any} */ proxyReq, /** @type {any} */ req) => {
                        // Forward the browser's cookies so Cloudflare sees a valid browser session
                        if (req.headers["cookie"]) {
                            proxyReq.setHeader("Cookie", req.headers["cookie"])
                        }
                        proxyReq.setHeader("Origin", "https://splice.com")
                        proxyReq.setHeader("Referer", "https://splice.com/")
                        proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
                    })
                    proxy.on("proxyRes", (/** @type {any} */ _proxyRes, /** @type {any} */ _req, /** @type {any} */ res) => {
                        // Allow CORS for localhost
                        res.setHeader("Access-Control-Allow-Origin", "*")
                        res.setHeader("Access-Control-Allow-Headers", "*")
                    })
                },
            },
        },
        watch: {
            // 3. tell vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
    },
}))
