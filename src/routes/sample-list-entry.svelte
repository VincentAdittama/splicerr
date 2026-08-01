<script lang="ts">
  import { globalAudio } from "$lib/shared/audio.svelte";
  import PackPreview from "$lib/components/pack-preview.svelte";
  import TagBadge from "$lib/components/tag-badge.svelte";
  import Waveform from "$lib/components/waveform.svelte";
  import type { SampleAsset } from "$lib/splice/types";
  import CircleX from "lucide-svelte/icons/circle-x";
  import Pause from "lucide-svelte/icons/pause";
  import Play from "lucide-svelte/icons/play";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import LoaderCircle from "lucide-svelte/icons/loader-circle";
  import { inview } from "svelte-inview";
  import { dataStore, fetchAssets } from "$lib/shared/store.svelte";
  import {
    addToPrefetchQueue,
    removeFromPrefetchQueue,
    inflightRequests,
    audioBufferCache,
  } from "$lib/shared/audio.svelte";
  import { cn, formatKey } from "$lib/utils";
  import { loading } from "$lib/shared/loading.svelte";
  import { assetIcons } from "$lib/shared/icons.svelte";
  import { handleSampleDrag, prepareSample } from "$lib/shared/drag.svelte";
  import { formatDisplayName } from "$lib/shared/display-name";

  let {
    class: className,
    selected,
    playing,
    sampleAsset,
  }: {
    class?: string;
    selected: boolean;
    playing: boolean;
    sampleAsset: SampleAsset;
  } = $props();

  let isInView = $state(false);

  $effect(() => {
    if (isInView && !selected && !playing) {
      if (
        audioBufferCache.has(sampleAsset.uuid) ||
        inflightRequests.has(sampleAsset.uuid)
      ) {
        return;
      }

      const timer = setTimeout(() => {
        addToPrefetchQueue(sampleAsset);
      }, 300);

      return () => {
        clearTimeout(timer);
        removeFromPrefetchQueue(sampleAsset);
      };
    }
  });

  let playButtonRef = $state<HTMLButtonElement>(null!);

  $effect(() => {
    if (selected) {
      playButtonRef.focus({ preventScroll: true });
    }
  });

  const pack = $derived(sampleAsset.parents.items[0]);
  // Original name for tooltip
  const originalName = $derived(sampleAsset.name.split("/").slice(-1)[0]);
  // Formatted name for display
  const name = $derived(formatDisplayName(originalName));

  const millisToMinutesAndSeconds = (millis: number) => {
    var minutes = Math.floor(millis / 60000);
    var seconds = Math.floor((millis % 60000) / 1000);
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  };
</script>

<div
  role="row"
  class={cn(
    "grid gap-4 items-center p-1 rounded-lg focus:outline-none cursor-pointer text-left transition-colors hover:bg-muted/60",
    selected && "bg-muted font-medium",
    className
  )}
  style="grid-template-columns: var(--sample-grid-cols, 48px minmax(200px, 2.5fr) 48px minmax(140px, 1.5fr) 60px 70px 60px);"
  id={`sample-list-entry-${sampleAsset.uuid}`}
  draggable={!loading.draggedSamples.has(sampleAsset.uuid)}
  tabindex="-1"
  use:inview={{
    rootMargin: "400px", // Start pre-fetching earlier
  }}
  oninview_change={(event) => (isInView = event.detail.inView)}
  onmousedown={() => {
    globalAudio.selectSampleAsset(sampleAsset, false);
    prepareSample(sampleAsset);
  }}
  ondragstart={(event) => handleSampleDrag(event, sampleAsset)}
  class:cursor-wait={loading.draggedSamples.has(sampleAsset.uuid)}
>
  <!-- Col 1: Pack -->
  <div class="flex items-center justify-center w-full h-full min-w-0">
    <PackPreview {pack} />
  </div>

  <!-- Col 2: Filename & Tags -->
  <div class="flex min-w-0 items-center gap-2 w-full h-full">
    {#if audioBufferCache.has(sampleAsset.uuid)}
      <div class="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0"></div>
    {/if}
    <div
      class={cn(
        "flex-1 min-w-0 text-left relative after:content-[''] after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-gradient-to-r after:from-transparent after:pointer-events-none",
        selected ? " after:to-muted" : "after:to-background"
      )}
    >
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger
            class="overflow-clip text-nowrap cursor-pointer text-sm font-medium hover:underline flex items-center gap-2"
          >
            {name}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {originalName}
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
      <div class="flex gap-0.5 text-xs overflow-clip text-nowrap">
        {#each sampleAsset.tags as tag}
          {@const active = dataStore.tags.includes(tag.uuid)}
          {@const tag_summary_tag = dataStore.tag_summary.find(
            (t: any) => t.tag.uuid == tag.uuid
          )}
          <TagBadge
            label={tag.label}
            variant="ghost"
            class="px-1 py-0.5 h-auto"
            count={tag_summary_tag?.count ?? 0}
            onclick={() => {
              if (!active) {
                dataStore.tags.push(tag.uuid);
                // updateTagSummary()
                fetchAssets();
              }
            }}
          />
        {/each}
      </div>
    </div>
  </div>

  <!-- Col 3: Play Button -->
  <div class="flex items-center justify-center w-full h-full min-w-0">
    <Button
      variant="ghost"
      bind:ref={playButtonRef}
      class="group flex-shrink-0 focus:outline-none"
      size="icon-lg"
      onclick={() =>
        playing ? globalAudio.pause() : globalAudio.playSampleAsset(sampleAsset)}
    >
      {#if (selected && globalAudio.loading) || (loading.samplesCount && loading.samples.has(sampleAsset.uuid)) || loading.draggedSamples.has(sampleAsset.uuid)}
        <LoaderCircle class="animate-spin" />
      {:else if playing}
        <Pause />
      {:else}
        <Play class="group-hover:block hidden" />
        {#if sampleAsset.asset_category_slug in assetIcons}
          {@const Icon = assetIcons[sampleAsset.asset_category_slug]}
          <Icon class="group-hover:hidden" />
        {:else}
          <CircleX class="group-hover:hidden" />
        {/if}
      {/if}
    </Button>
  </div>

  <!-- Col 4: Waveform -->
  <div class="flex items-center min-w-0 w-full h-full md:flex hidden">
    <Waveform
      src={sampleAsset.files[1].url}
      progress={selected ? globalAudio.progress() : 0}
      onseek={(progress) => {
        const startTime = progress * (sampleAsset.duration / 1000);
        globalAudio.playSampleAsset(sampleAsset, startTime);
      }}
      class="w-full h-10 md:block hidden"
    />
  </div>

  <!-- Col 5: Time -->
  <div class="flex items-center justify-end w-full h-full text-muted-foreground text-xs font-mono min-w-0">
    {millisToMinutesAndSeconds(sampleAsset.duration)}
  </div>

  <!-- Col 6: Key -->
  <div class="flex items-center justify-end w-full h-full text-muted-foreground text-xs font-mono min-w-0">
    {(sampleAsset.key && formatKey(sampleAsset.key, sampleAsset.chord_type)) ??
      "--"}
  </div>

  <!-- Col 7: BPM -->
  <div class="flex items-center justify-end w-full h-full text-muted-foreground text-xs font-mono min-w-0">
    {sampleAsset.bpm ?? "--"}
  </div>
</div>
