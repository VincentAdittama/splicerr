<script lang="ts">
  import { loading } from "$lib/shared/store.svelte";
  import { httpFetch } from "$lib/shared/http";
  import pako from "pako";
  import { inview } from "svelte-inview";
  import { cn } from "$lib/utils";

  let canvasRef = $state<HTMLCanvasElement>(null!);
  let containerRef = $state<HTMLButtonElement>(null!);

  let {
    src,
    progress = 0,
    class: className,
    onseek,
  }: {
    src: string;
    progress?: number;
    class?: string;
    onseek: (progress: number) => void;
  } = $props();

  // ── State ─────────────────────────────────────────────────────────────────
  let waveform = $state<number[]>([]);
  let loadedSrc = $state("");
  let isLoading = $state(false);

  const loaded = $derived(loadedSrc === src);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  $effect(() => {
    if (!isLoading && !loaded && !loading.fetchError && src) {
      fetchWaveform();
    }
  });

  function fetchWaveform() {
    isLoading = true;
    loading.waveformsCount += 1;
    const loadingSrc = src;

    httpFetch(src)
      .then((resp) => {
        if (loadingSrc !== src) {
          loading.waveformsCount -= 1;
          isLoading = false;
          return;
        }
        resp
          .arrayBuffer()
          .then((buff) => {
            const bytes = new Uint8Array(buff);
            let data: number[];
            if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
              const inflated = pako.inflate(bytes, { to: "string" });
              data = JSON.parse(inflated);
            } else {
              data = JSON.parse(new TextDecoder().decode(bytes));
            }
            waveform = data;
            loadedSrc = loadingSrc;
            loading.waveformsCount -= 1;
            isLoading = false;
          })
          .catch((err) => {
            console.error("⚠️ Failed parsing waveform", err);
            loading.waveformsCount -= 1;
            isLoading = false;
          });
      })
      .catch((err) => {
        console.error("⚠️ Failed fetching waveform", err);
        loading.waveformsCount -= 1;
        isLoading = false;
      });
  }

  // ── Canvas drawing ─────────────────────────────────────────────────────────
  const BAR_WIDTH = 2;
  const BAR_GAP = 1;
  const BAR_STEP = BAR_WIDTH + BAR_GAP;
  const MIN_BAR_HEIGHT = 2;

  // Pre-computed peaks so we don't re-process waveform data every frame
  let cachedPeaks: number[] = [];
  let cachedBarCount = 0;
  let cachedGlobalMax = 0;
  let cachedWaveformRef: number[] | null = null; // track which array was cached

  function computePeaks(W: number) {
    const data = waveform;
    const barCount = Math.max(1, Math.floor(W / BAR_STEP));
    // Invalidate if canvas width changed OR if waveform data is different (tab switch)
    if (barCount === cachedBarCount && cachedPeaks.length > 0 && cachedWaveformRef === data) return;

    cachedBarCount = barCount;
    cachedWaveformRef = data;

    const peaks: number[] = [];
    let max = 0.001;

    for (let i = 0; i < barCount; i++) {
      const start = Math.floor((i * data.length) / barCount);
      const end = Math.min(data.length, Math.floor(((i + 1) * data.length) / barCount));
      let barMax = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]);
        if (v > barMax) barMax = v;
      }
      peaks.push(barMax);
      if (barMax > max) max = barMax;
    }

    // Preserve dynamic range scale (if max > 1 values are 0..100, otherwise 0..1)
    const absoluteMax = max > 1 ? Math.max(max, 100) : Math.max(max, 1.0);

    cachedPeaks = peaks;
    cachedGlobalMax = absoluteMax;
  }

  function getComputedColor(varName: string): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
  }

  function drawFrame() {
    const canvas = canvasRef;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (W === 0 || H === 0) return;

    // Resize backing store on HiDPI or layout change
    const expectedW = Math.round(W * dpr);
    const expectedH = Math.round(H * dpr);
    if (canvas.width !== expectedW || canvas.height !== expectedH) {
      canvas.width = expectedW;
      canvas.height = expectedH;
      cachedBarCount = 0; // force recompute
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const data = waveform;
    const midY = H / 2;

    // Resolve colors (cached by CSS)
    const primaryHsl = getComputedColor("--primary");
    const mutedHsl = getComputedColor("--muted-foreground");
    const playedColor = `hsl(${primaryHsl})`;
    const unplayedColor = `hsl(${mutedHsl})`;

    if (!data.length) {
      // Placeholder: flat line
      ctx.fillStyle = unplayedColor;
      ctx.fillRect(0, midY - 1, W, 2);
      ctx.restore();
      return;
    }

    computePeaks(W);

    // Read progress fresh — this is intentionally NOT tracked by Svelte
    // so we can read it every frame without triggering reactive re-runs.
    const currentProgress = progress;
    const progressX = currentProgress * W;

    for (let i = 0; i < cachedPeaks.length; i++) {
      const x = i * BAR_STEP;
      const normalizedH = (cachedPeaks[i] / cachedGlobalMax) * (midY * 0.88);
      const barH = Math.max(normalizedH, MIN_BAR_HEIGHT);

      ctx.fillStyle = x + BAR_WIDTH / 2 <= progressX ? playedColor : unplayedColor;
      ctx.fillRect(x, midY - barH, BAR_WIDTH, barH * 2);
    }

    // Playhead cursor
    if (currentProgress > 0 && currentProgress < 1) {
      ctx.fillStyle = playedColor;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(Math.round(progressX) - 1, 0, 2, H);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ── Animation loop ─────────────────────────────────────────────────────────
  // Runs every rAF frame so the playhead always reflects the latest progress
  // value without waiting for Svelte reactivity.
  let rafId: number;

  $effect(() => {
    // Reactive dependency: restart the loop when canvas mounts or waveform loads
    const _canvas = canvasRef;
    const _loaded = loaded;
    const _src = src;
    void _canvas;
    void _loaded;
    void _src;

    // Invalidate peaks cache whenever src/waveform changes (tab switch)
    cachedBarCount = 0;
    cachedWaveformRef = null;

    function loop() {
      drawFrame();
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  });

  // Invalidate peaks cache on resize so bars recompute for new width
  function onResize() {
    cachedBarCount = 0;
  }
</script>

<button
  class={cn(className, "focus:outline-none cursor-pointer relative block")}
  tabindex={-1}
  use:inview
  onclick={(event) => {
    const rect = containerRef.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onseek(p);
  }}
  bind:this={containerRef}
  aria-label="Waveform"
>
  <canvas
    bind:this={canvasRef}
    class={cn(
      "block w-full h-full cursor-pointer transition-opacity duration-500",
      !loaded && "opacity-0"
    )}
  ></canvas>
</button>

<svelte:window onresize={onResize} />
