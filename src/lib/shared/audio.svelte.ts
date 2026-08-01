import type { SampleAsset } from "$lib/splice/types"
import { loading } from "$lib/shared/loading.svelte"
import { config } from "$lib/shared/config.svelte"
import {
    dataStore,
} from "$lib/shared/store.svelte"
import { descrambleSample } from "$lib/splice/descrambler"
import { httpFetch } from "$lib/shared/http"

import { SvelteMap } from "svelte/reactivity"

// Initialize AudioContext
export const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
const gainNode = ctx.createGain()
gainNode.connect(ctx.destination)

// Debug AudioContext state
ctx.onstatechange = () => {
    console.log("🔊 AudioContext state changed to:", ctx.state)
}

// LRU Cache for AudioBuffers
const BUFFER_CACHE_LIMIT = 50
export const audioBufferCache = new SvelteMap<string, AudioBuffer>()
export const inflightRequests = new SvelteMap<string, Promise<AudioBuffer>>()

// Helper to manage LRU
function cacheAudioBuffer(uuid: string, buffer: AudioBuffer) {
    if (audioBufferCache.size >= BUFFER_CACHE_LIMIT) {
        // Delete the first (oldest) entry
        const firstKey = audioBufferCache.keys().next().value
        if (firstKey) audioBufferCache.delete(firstKey)
    }
    audioBufferCache.set(uuid, buffer)
}

export async function getDescrambledSample(sampleAsset: SampleAsset): Promise<AudioBuffer> {
    const cached = audioBufferCache.get(sampleAsset.uuid)
    if (cached) {
        // Refresh LRU position
        audioBufferCache.delete(sampleAsset.uuid)
        audioBufferCache.set(sampleAsset.uuid, cached)
        return cached
    }

    const inflight = inflightRequests.get(sampleAsset.uuid)
    if (inflight) {
        return inflight
    }

    const promise = (async () => {
        try {
            loading.samples.add(sampleAsset.uuid)
            loading.samplesCount++

            console.log("⬇️ Fetching audio:", sampleAsset.name)
            const response = await httpFetch(sampleAsset.files[0].url)
            const data = new Uint8Array(await response.arrayBuffer())
            const descrambledData = descrambleSample(data)

            // Decode Audio Data
            console.log("🧩 Decoding audio:", sampleAsset.name)
            // We need to copy the buffer because decodeAudioData detaches it
            const audioBuffer = await ctx.decodeAudioData(descrambledData.buffer.slice(0) as ArrayBuffer)
            
            cacheAudioBuffer(sampleAsset.uuid, audioBuffer)
            console.log("✅ Audio ready:", sampleAsset.name)
            return audioBuffer
        } catch (error) {
            console.error("❌ Failed to decode audio", error)
            throw error
        } finally {
            loading.samples.delete(sampleAsset.uuid)
            loading.samplesCount--
            inflightRequests.delete(sampleAsset.uuid)
            processPrefetchQueue()
        }
    })()

    inflightRequests.set(sampleAsset.uuid, promise)
    return promise
}

const prefetchQueue = new Set<SampleAsset>()

export function addToPrefetchQueue(sampleAsset: SampleAsset) {
    if (audioBufferCache.has(sampleAsset.uuid) || inflightRequests.has(sampleAsset.uuid)) return
    prefetchQueue.add(sampleAsset)
    processPrefetchQueue()
}

export function removeFromPrefetchQueue(sampleAsset: SampleAsset) {
    prefetchQueue.delete(sampleAsset)
}

export function processPrefetchQueue() {
    while (loading.samples.size < 10 && prefetchQueue.size > 0) {
        const next = prefetchQueue.values().next().value
        if (!next) break
        prefetchQueue.delete(next)
        
        if (audioBufferCache.has(next.uuid) || inflightRequests.has(next.uuid)) continue

        console.info("📡 Queue dispatching pre-fetch:", next.name)
        getDescrambledSample(next).catch(err => {
             console.warn("⚠️ Pre-fetch failed for", next.uuid, err)
        })
    }
}

export function prefetchSample(sampleAsset: SampleAsset) {
   addToPrefetchQueue(sampleAsset)
}

export function freeAudioBuffer(uuid: string) {
    audioBufferCache.delete(uuid)
}


let sourceNode: AudioBufferSourceNode | null = null
let startTime = 0
let pauseTime = 0
let isPlaying = false
let playbackRate = 1

export const globalAudio = $state({
    currentAsset: null as SampleAsset | null,
    paused: true,
    currentTime: 0, 
    duration: 0,
    loading: false,
    volume: 0.8,
    
    progress() {
        return this.duration > 0 ? this.currentTime / this.duration : 0
    },

    togglePlay() {
        if (this.paused) {
            this.resume()
        } else {
            this.pause()
        }
    },

    toggleMute() {
        if (this.volume > 0) {
            this.volume = 0
        } else {
            this.volume = 0.8 
        }
        gainNode.gain.value = this.volume
    },

    stop() {
        if (sourceNode) {
            try {
                sourceNode.stop()
                sourceNode.disconnect()
            } catch (e) {
                // Ignore errors if already stopped
            }
            sourceNode = null
        }
        this.paused = true
        isPlaying = false
        pauseTime = 0
        this.currentTime = 0
    },

    pause() {
        if (!isPlaying) return
        if (sourceNode) {
            try {
                sourceNode.stop()
                sourceNode.disconnect()
            } catch (e) { }
            sourceNode = null
        }
        pauseTime = this.currentTime
        this.paused = true
        isPlaying = false
    },

    async resume() {
        if (!this.currentAsset) return
        this.paused = false
        const buffer = await getDescrambledSample(this.currentAsset)
        this.playBuffer(buffer, pauseTime)
    },

    async selectSampleAsset(sampleAsset: SampleAsset, play: boolean = true) {
        if (this.currentAsset?.uuid != sampleAsset.uuid) {
            this.stop()
            this.currentAsset = sampleAsset
            this.duration = sampleAsset.duration / 1000 
        }
    },

    async playSampleAsset(sampleAsset: SampleAsset, from: number = 0) {
        console.log("▶️ Request to play:", sampleAsset.name)
        
        if (ctx.state === 'suspended') {
            console.log("⚠️ AudioContext suspended. Resuming...")
            await ctx.resume()
            console.log("🔊 AudioContext resumed. State:", ctx.state)
        }

        try {
            // Get the buffer first
            const buffer = await getDescrambledSample(sampleAsset)
            
            // Check if user switched while waiting
            if (this.currentAsset?.uuid && this.currentAsset.uuid !== sampleAsset.uuid) {
                console.log("⏭️ Switched asset during load, ignoring playback")
                return
            }

            // Clean up previous
            this.stop()

            this.currentAsset = sampleAsset
            this.duration = buffer.duration
            this.paused = false
            
            this.playBuffer(buffer, from)
        } catch (e) {
            console.error("☠️ Error playing sample:", e)
        }
    },

    playBuffer(buffer: AudioBuffer, offset: number = 0) {
        try {
            // Create new source node
            sourceNode = ctx.createBufferSource()
            sourceNode.buffer = buffer
            sourceNode.connect(gainNode)
            
            sourceNode.loop = this.currentAsset?.asset_category_slug == "loop" && config.repeat_audio
            
            // Start playback
            sourceNode.start(0, offset)
            console.log("🔊 Playback started at", offset)
            
            startTime = ctx.currentTime - offset
            pauseTime = offset
            isPlaying = true
            this.paused = false
            
            sourceNode.onended = () => {
                if (
                    this.paused ||
                    this.currentAsset?.uuid != this.currentAsset?.uuid ||
                    this.currentTime != 0
                ) {
                    return
                }
                
                if (this.currentAsset?.asset_category_slug == "loop" && config.repeat_audio) {
                    return
                }

                this.stop()
                console.log("⏹️ Sample finished naturally")
            }
        } catch (e) {
            console.error("❌ Error in playBuffer:", e)
        }
    },
    
    seek(progress: number) {
        if (!this.currentAsset) return
        const time = progress * this.duration
        if (!this.paused) {
            this.resumeAt(time)
        } else {
             pauseTime = time
             this.currentTime = time
        }
    },

    seekRelative(deltaSec: number) {
        if (!this.currentAsset) return
        const newTime = Math.max(0, Math.min(this.duration, this.currentTime + deltaSec))
        if (!this.paused) {
            this.resumeAt(newTime)
        } else {
            pauseTime = newTime
            this.currentTime = newTime
        }
    },

    restart() {
        if (!this.currentAsset) return
        this.resumeAt(0)
    },

    volumeUp(step: number = 0.1) {
        this.volume = Math.min(1, this.volume + step)
        gainNode.gain.value = this.volume
    },

    volumeDown(step: number = 0.1) {
        this.volume = Math.max(0, this.volume - step)
        gainNode.gain.value = this.volume
    },

    async resumeAt(time: number) {
         if (!this.currentAsset) return
         if (sourceNode) {
             try { sourceNode.stop(); sourceNode.disconnect(); } catch (e) {}
         }
         const buffer = await getDescrambledSample(this.currentAsset)
         this.playBuffer(buffer, time)
    },
    
    updateTime() {
        if (isPlaying) {
            if (sourceNode?.loop) {
                this.currentTime = (ctx.currentTime - startTime) % this.duration
            } else {
                this.currentTime = Math.min(ctx.currentTime - startTime, this.duration)
            }
        }
    }
})

function uiLoop() {
    globalAudio.updateTime()
    requestAnimationFrame(uiLoop)
}
if (typeof window !== "undefined") {
    requestAnimationFrame(uiLoop)
}
