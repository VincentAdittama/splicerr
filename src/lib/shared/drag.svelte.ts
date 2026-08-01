import { startDrag } from "@crabnebula/tauri-plugin-drag"
import { join, appCacheDir } from "@tauri-apps/api/path"
import { exists, create, mkdir, writeFile } from "@tauri-apps/plugin-fs"
import { invoke } from "@tauri-apps/api/core"
import { saveSample } from "./files.svelte"
import { loading } from "./loading.svelte"
import { globalAudio } from "./audio.svelte"
import { settingsDialog } from "./config.svelte"
import type { SampleAsset, PackAsset } from "$lib/splice/types"

// Cache for in-flight or completed preparations
const preparationCache = new Map<string, Promise<{ path: string, iconPath: string }>>()

async function getIconPath(sampleAsset: SampleAsset): Promise<string> {
    const pack = sampleAsset.parents.items[0] as PackAsset
    if (pack.files[0]?.url) {
        return await invoke("process_drag_icon", { imageUrl: pack.files[0].url, packId: pack.uuid });
    } else {
        return await createInvisibleIcon()
    }
}

export function prepareSample(sampleAsset: SampleAsset) {
    if (preparationCache.has(sampleAsset.uuid)) {
        return preparationCache.get(sampleAsset.uuid)!
    }

    const promise = (async () => {
        try {
            const [path, iconPath] = await Promise.all([
                saveSample(sampleAsset),
                getIconPath(sampleAsset)
            ])
            return { path, iconPath }
        } catch (e) {
            preparationCache.delete(sampleAsset.uuid) // invalidating cache on error
            throw e
        }
    })()

    preparationCache.set(sampleAsset.uuid, promise)
    return promise
}

async function createInvisibleIcon(): Promise<string> {
    const cacheDir = await appCacheDir()
    const iconPath = await join(cacheDir, "invisible-drag-icon.png")

    if (!(await exists(iconPath))) {
        if (!(await exists(cacheDir))) {
            await mkdir(cacheDir)
        }

        const transparentPng = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
            0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
            0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x02, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
            0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
        ])

        await writeFile(iconPath, transparentPng)
    }

    return iconPath
}

export async function handleSampleDrag(event: DragEvent, sampleAsset: SampleAsset) {
    event.preventDefault()
    console.log("🫳 Dragging", sampleAsset.name)

    try {
        loading.setCursor(true)
        // Mark this specific sample as being prepared for drag
        loading.draggedSamples.add(sampleAsset.uuid)

        // Use prepareSample to get the promise (either cached or new)
        const { path, iconPath } = await prepareSample(sampleAsset)
        
        console.log("🐉 Start Drag:", { path, iconPath })

        // Await startDrag - it returns a promise that resolves when the drag operation completes
        await startDrag({ item: [path], icon: iconPath })
        
        // Only pause audio after a successful drag operation (drop completed)
        console.log("🛑 Drag completed, stopping audio")
        globalAudio.pause()
    } catch (e: any) {
        console.error("⚠️ Error dragging", e)
        if (e?.message?.includes("Samples Directory")) {
            settingsDialog.open = true
        }
    } finally {
        // Clear the drag loading state and reset cursor
        loading.draggedSamples.delete(sampleAsset.uuid)
        loading.setCursor(false)
    }
}
