import { resetMode, setMode } from "mode-watcher"

const CONFIG_FILE_NAME = "config.json"

export type UITheme = "system" | "light" | "dark"

const DEFAULT_CONFIG = {
    samples_dir: null as string | null,
    ui_theme: "system" as UITheme,
    ui_scale: 1,
    cut_mp3_delay: true,
    repeat_audio: true,
}

const isTauri = () =>
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

let samplesDirValid = $state(false)

export let settingsDialog = $state({ open: false })

export const isSamplesDirValid = () => samplesDirValid

export let config = $state<typeof DEFAULT_CONFIG>(
    JSON.parse(JSON.stringify(DEFAULT_CONFIG))
)

export async function validateSamplesDir() {
    // Strip surrounding quotes and whitespace (e.g. user pastes '/path/' or "/path/")
    if (config.samples_dir) {
        config.samples_dir = config.samples_dir
            .trim()
            .replace(/^(['"])(.*)\1$/, "$2")
            .trim()
    }

    if (!isTauri()) {
        // In web mode, treat any non-empty string as valid
        samplesDirValid = !!config.samples_dir && config.samples_dir.trim() !== ""
        return samplesDirValid
    }

    const { isAbsolute } = await import("@tauri-apps/api/path")
    const { exists, stat } = await import("@tauri-apps/plugin-fs")

    async function validate() {
        if (!config.samples_dir) return false
        if (!(await isAbsolute(config.samples_dir))) return false
        if (!(await exists(config.samples_dir))) return false
        if (!(await stat(config.samples_dir)).isDirectory) return false
        return true
    }

    samplesDirValid = await validate()

    console.log(
        samplesDirValid
            ? "✅ Samples Directory valid"
            : "❌ Samples Directory invalid"
    )

    return samplesDirValid
}

export async function loadConfig() {
    if (!isTauri()) {
        // In web mode, load from localStorage
        const stored = localStorage.getItem(CONFIG_FILE_NAME)
        if (stored) {
            Object.assign(config, JSON.parse(stored))
            console.log("📂 Config loaded from localStorage")
        } else {
            // No saved config — leave samples_dir null so user can type their own path
            console.log("📂 Config not found, using defaults")
        }
        await validateSamplesDir()
        return
    }

    const { appConfigDir } = await import("@tauri-apps/api/path")
    const { exists, BaseDirectory, readTextFile, mkdir, create } = await import("@tauri-apps/plugin-fs")

    if (
        !(await exists(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig }))
    ) {
        console.log("📂 Config not found, keeping default")
    } else {
        const fileContent = await readTextFile("config.json", {
            baseDir: BaseDirectory.AppConfig,
        })
        Object.assign(config, JSON.parse(fileContent))
        console.log("📂 Config loaded")
    }

    await validateSamplesDir()
}

export async function saveConfig() {
    if (!isTauri()) {
        // In web mode, persist to localStorage
        await validateSamplesDir()
        localStorage.setItem(CONFIG_FILE_NAME, JSON.stringify(config))
        console.log("💾 Config saved to localStorage")
        return
    }

    await validateSamplesDir()

    const { appConfigDir } = await import("@tauri-apps/api/path")
    const { exists, BaseDirectory, writeTextFile, mkdir, create } = await import("@tauri-apps/plugin-fs")

    const appConfig = await appConfigDir()
    if (!(await exists(appConfig))) await mkdir(appConfig)

    if (
        !(await exists(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig }))
    ) {
        await create(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig })
    }

    await writeTextFile(CONFIG_FILE_NAME, JSON.stringify(config), {
        baseDir: BaseDirectory.AppConfig,
    })
    console.log("💾 Config saved")
}

export function updateTheme() {
    switch (config.ui_theme) {
        case "system":
            resetMode()
            break
        default:
            setMode(config.ui_theme)
            break
    }
}
