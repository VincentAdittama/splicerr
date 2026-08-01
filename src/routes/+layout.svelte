<script lang="ts">
    import "../app.css"
    import { ModeWatcher } from "mode-watcher"
    import { getCurrentWebview } from "@tauri-apps/api/webview"
    import {
        config,
        isSamplesDirValid,
        loadConfig,
        settingsDialog,
    } from "$lib/shared/config.svelte"
    import { onMount } from "svelte"
    import setupLocatorUI from "@locator/runtime"

    let { children } = $props()

    const DEFAULT_SCALE = 0.8

    $effect(() => {
        getCurrentWebview().setZoom(config.ui_scale * DEFAULT_SCALE)
    })

    onMount(() => {
        if (import.meta.env.DEV) {
            setupLocatorUI({
                adapter: "svelte",
                projectPath: typeof __PROJECT_PATH__ !== "undefined" ? __PROJECT_PATH__ : "",
                targets: {
                    "antigravity-ide": "antigravity-ide://file${projectPath}/${filePath}:${line}:${column}",
                    antigravity: "antigravity://file${projectPath}/${filePath}:${line}:${column}",
                    zed: "zed://file${projectPath}/${filePath}:${line}:${column}",
                    vscode: "vscode://file${projectPath}/${filePath}:${line}:${column}",
                    cursor: "cursor://file${projectPath}/${filePath}:${line}:${column}",
                },
            })
        }

        loadConfig().then(() => {
            if (!isSamplesDirValid()) {
                settingsDialog.open = true
            }
        })
    })
</script>

<ModeWatcher />
{@render children?.()}
