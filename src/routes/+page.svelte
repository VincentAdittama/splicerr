<script lang="ts">
  import SampleListEntry from "./sample-list-entry.svelte";
  import SearchInput from "$lib/components/search-input.svelte";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { onMount, tick } from "svelte";
  import SortSelect from "$lib/components/sort-select.svelte";
  import Search from "lucide-svelte/icons/search";
  import Smile from "lucide-svelte/icons/smile";
  import Ghost from "lucide-svelte/icons/ghost";
  import AlertTriangle from "lucide-svelte/icons/alert-triangle";
  import RotateCw from "lucide-svelte/icons/rotate-cw";
  import Shuffle from "lucide-svelte/icons/shuffle";
  import Button from "$lib/components/ui/button/button.svelte";
  import GenreSelect from "$lib/components/genre-select.svelte";
  import ProgressLoading from "$lib/components/progress-loading.svelte";
  import Separator from "$lib/components/ui/separator/separator.svelte";
  import SortHeader from "$lib/components/sort-header.svelte";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import { cn } from "$lib/utils";
  import AssetCategorySelect from "$lib/components/asset-category-select.svelte";
  import BpmSelect from "$lib/components/bpm-select.svelte";
  import AudioPlayer from "$lib/components/audio-player.svelte";
  import TagBadge from "$lib/components/tag-badge.svelte";
  import { globalAudio } from "$lib/shared/audio.svelte";
  import type { AssetSortType } from "$lib/splice/types";
  import {
    loading,
    dataStore,
    storeCallbacks,
    queryStore,
    fetchAssets,
    fetchAllGenres,
    isTagSelected,
    toggleTag,
    DEFAULT_SORT,
    randomSeed,
  } from "$lib/shared/store.svelte";
  import SettingsDialog from "$lib/components/settings-dialog.svelte";
  import KeySelect from "$lib/components/key-select.svelte";
  import TabBar from "$lib/components/tab-bar.svelte";
  import { tabManager } from "$lib/shared/tabs.svelte";

  // TODO: Taxonomy comboboxes (maybe just pass all tags to each)
  // const instrumentTags = $derived(() =>
  //     dataStore.tag_summary.filter(
  //         (entry) => entry.tag.taxonomy.name == "Instrument"
  //     )
  // )

  // const genreTags = $derived(() =>
  //     dataStore.tag_summary.filter(
  //         (entry) => entry.tag.taxonomy.name == "Genre"
  //     )
  // )

  $effect(() => {
    if (queryStore.sort in ["random", "popularity", "relevance", "recency"]) {
      queryStore.order = "DESC";
    }
  });

  // Restore scroll position when tab changes
  $effect(() => {
    const _ = tabManager.activeTabId;
    tick().then(() => {
      if (viewportRef) {
        viewportRef.scrollTop = tabManager.activeTab.scrollPosition;
      }
    });
  });

  $effect(() => {
    if (loading.beforeFirstLoad && !loading.assets) {
      fetchAssets();
    }
  });

  storeCallbacks.onbeforedataupdate = () => {
    viewportRef.scrollTo({ top: 0, behavior: "smooth" });
  };

  storeCallbacks.onbeforetagsupdate = () => {
    tagsDrawerRef.style.height = `${tagsContainerRef.offsetHeight}px`;
  };

  let expandTags = $state(false);

  let viewportRef = $state<HTMLElement>(null!);
  let tagsContainerRef = $state<HTMLElement>(null!);
  let tagsDrawerRef = $state<HTMLElement>(null!);
  let searchInputRef = $state<HTMLInputElement>(null!);

  const selectedSampleIndex = $derived(
    dataStore.sampleAssets.findIndex(
      (sampleAsset) => sampleAsset.uuid == globalAudio.currentAsset?.uuid
    )
  );

  const updateSort = (newSort: AssetSortType) => {
    if (queryStore.sort == newSort) {
      if (queryStore.order == "DESC") {
        queryStore.order = "ASC";
      } else {
        queryStore.sort = DEFAULT_SORT;
      }
    } else {
      queryStore.sort = newSort;
      queryStore.order = "DESC";
    }
    fetchAssets();
  };

  const gotoPrev = (autoPlay: boolean = true) => {
    if (dataStore.sampleAssets.length === 0) return;

    const currentIndex = dataStore.sampleAssets.findIndex(
      (asset) => asset.uuid === globalAudio.currentAsset?.uuid
    );

    // If no sample selected or at first sample, select first sample
    const targetIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
    const sampleAsset = dataStore.sampleAssets[targetIndex];

    // Optimistically select to allow rapid navigation
    globalAudio.selectSampleAsset(sampleAsset);

    if (autoPlay) {
      globalAudio.playSampleAsset(sampleAsset);
    } else {
      globalAudio.selectSampleAsset(sampleAsset);
    }
    const entryEl = document.getElementById(
      `sample-list-entry-${sampleAsset.uuid}`
    );
    if (entryEl)
      entryEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  // Wrappers for AudioPlayer (always auto-play on button click)
  const onPrevClick = () => gotoPrev(true);
  const onNextClick = () => gotoNext(true);

  const gotoNext = (autoPlay: boolean = true) => {
    if (dataStore.sampleAssets.length === 0) return;

    const currentIndex = dataStore.sampleAssets.findIndex(
      (asset) => asset.uuid === globalAudio.currentAsset?.uuid
    );

    // If no sample selected, select first; otherwise select next (or stay at last)
    let targetIndex: number;
    if (currentIndex === -1) {
      targetIndex = 0;
    } else if (currentIndex + 1 < dataStore.sampleAssets.length) {
      targetIndex = currentIndex + 1;
    } else {
      return; // Already at last sample
    }

    const sampleAsset = dataStore.sampleAssets[targetIndex];

    // Optimistically select to allow rapid navigation
    globalAudio.selectSampleAsset(sampleAsset);

    if (autoPlay) {
      globalAudio.playSampleAsset(sampleAsset);
    }
    const entryEl = document.getElementById(
      `sample-list-entry-${sampleAsset.uuid}`
    );
    if (entryEl)
      entryEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const gotoFirst = (autoPlay: boolean = true) => {
    if (dataStore.sampleAssets.length === 0) return;
    const sampleAsset = dataStore.sampleAssets[0];

    globalAudio.selectSampleAsset(sampleAsset);

    if (autoPlay) {
      globalAudio.playSampleAsset(sampleAsset);
    } else {
      globalAudio.selectSampleAsset(sampleAsset);
    }
    const entryEl = document.getElementById(
      `sample-list-entry-${sampleAsset.uuid}`
    );
    if (entryEl)
      entryEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const gotoLast = (autoPlay: boolean = true) => {
    if (dataStore.sampleAssets.length === 0) return;
    const sampleAsset =
      dataStore.sampleAssets[dataStore.sampleAssets.length - 1];

    globalAudio.selectSampleAsset(sampleAsset);

    if (autoPlay) {
      globalAudio.playSampleAsset(sampleAsset);
    } else {
      globalAudio.selectSampleAsset(sampleAsset);
    }
    const entryEl = document.getElementById(
      `sample-list-entry-${sampleAsset.uuid}`
    );
    if (entryEl)
      entryEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const playRandom = () => {
    if (dataStore.sampleAssets.length === 0) return;
    const randomIndex = Math.floor(
      Math.random() * dataStore.sampleAssets.length
    );
    const sampleAsset = dataStore.sampleAssets[randomIndex];
    globalAudio.playSampleAsset(sampleAsset);
    const entryEl = document.getElementById(
      `sample-list-entry-${sampleAsset.uuid}`
    );
    if (entryEl)
      entryEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const isInputFocused = () => {
    const activeEl = document.activeElement;
    return (
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement ||
      (activeEl instanceof HTMLElement && activeEl.isContentEditable)
    );
  };

  const handleGlobalKeydown = (e: KeyboardEvent) => {
    const inputFocused = isInputFocused();

    // Define which keys should ALWAYS work (even when typing in search)
    const navigationKeys = ["ArrowUp", "ArrowDown", "Escape"];
    const isNavigationKey = navigationKeys.includes(e.key);

    // If input is focused and it's NOT a navigation key, skip
    if (inputFocused && !isNavigationKey) {
      return;
    }

    // If input is focused and it IS a navigation key, blur first for arrow keys
    if (inputFocused && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      (document.activeElement as HTMLElement)?.blur();
    }

    const silentNav = e.shiftKey;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        gotoPrev(!silentNav);
        break;
      case "ArrowDown":
        e.preventDefault();
        gotoNext(!silentNav);
        break;
      case "ArrowLeft":
        e.preventDefault();
        globalAudio.seekRelative(-5);
        break;
      case "ArrowRight":
        e.preventDefault();
        globalAudio.seekRelative(5);
        break;
      case " ":
        e.preventDefault();
        if (e.shiftKey) {
          playRandom();
        } else {
          globalAudio.togglePlay();
        }
        break;
      case "Enter":
        e.preventDefault();
        if (globalAudio.currentAsset) {
          globalAudio.playSampleAsset(globalAudio.currentAsset, 0);
        } else if (dataStore.sampleAssets.length > 0) {
          gotoFirst(true);
        }
        break;
      case "Escape":
        e.preventDefault();
        if (inputFocused) {
          (document.activeElement as HTMLElement)?.blur();
        } else {
          globalAudio.stop();
        }
        break;
      case "r":
      case "R":
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          globalAudio.restart();
        }
        break;
      case "m":
      case "M":
        e.preventDefault();
        globalAudio.toggleMute();
        break;
      case "/":
        e.preventDefault();
        searchInputRef.focus();
        break;
      case "k":
      case "K":
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          searchInputRef.focus();
        }
        break;
      case "[":
        e.preventDefault();
        globalAudio.volumeDown();
        break;
      case "]":
        e.preventDefault();
        globalAudio.volumeUp();
        break;
      case "Home":
        e.preventDefault();
        gotoFirst(!silentNav);
        break;
      case "End":
        e.preventDefault();
        gotoLast(!silentNav);
        break;
      case "t":
      case "T":
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          tabManager.addTab();
        }
        break;
      case "w":
      case "W":
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          tabManager.closeTab(tabManager.activeTabId);
        }
        break;
    }
  };

  // const updateTagSummary = () =>
  //     dataStore.tag_summary.sort(
  //         (a: any, b: any) =>
  //             Number(dataStore.tags.includes(b.tag.uuid)) -
  //             Number(dataStore.tags.includes(a.tag.uuid))
  //     )

  onMount(() => {
    viewportRef.addEventListener("scroll", () => {
      // Save scroll position for tab
      if (tabManager.activeTab) {
        tabManager.activeTab.scrollPosition = viewportRef.scrollTop;
      }

      if (
        !loading.assets &&
        viewportRef.scrollTop + viewportRef.clientHeight >=
          viewportRef.scrollHeight - viewportRef.clientHeight
      ) {
        queryStore.page += 1;
        console.log("📃 End of list reached, loading more assets");
        fetchAssets();
      }
    });

    searchInputRef?.focus();

    // Initial load only if empty? Or simple logic:
    // fetchAssets();
    // fetchAllGenres();
    // But now we have tabs.
    // If the tab is fresh, it might need assets.
    // fetchAssets checks if currently loading?

    // Actually, on new tab creation we might want to trigger `fetchAssets()`.
    // But `Tab` is constructor based.

    // Taxonomy is global, ensure loaded
    if (dataStore.all_genres.length === 0) {
      fetchAllGenres();
    }
  });
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<main class="flex flex-col size-full">
  <div class="flex flex-col p-4 gap-4">
    <TabBar class="w-full" />
    <div class="flex gap-4 justify-between items-center">
      <SettingsDialog />
      <SearchInput
        bind:value={queryStore.query}
        onsubmit={fetchAssets}
        class="flex-grow"
        bind:inputRef={searchInputRef}
      />
      <KeySelect
        bind:key={queryStore.key}
        bind:chord_type={queryStore.chord_type}
        onselect={fetchAssets}
      />
      <BpmSelect
        bind:bpm={queryStore.bpm}
        bind:min_bpm={queryStore.min_bpm}
        bind:max_bpm={queryStore.max_bpm}
        onsubmit={fetchAssets}
      />
      <AssetCategorySelect
        bind:asset_category_slug={queryStore.asset_category_slug}
        onselect={fetchAssets}
      />
    </div>

    <div
      class="transition-[height] ease-in-out overflow-clip"
      bind:this={tagsDrawerRef}
    >
      <div class="flex justify-between gap-2" bind:this={tagsContainerRef}>
        <div
          class={cn(
            "min-w-0 relative",
            !expandTags &&
              "pr-4 after:content-[''] after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-gradient-to-r after:from-transparent after:to-background after:pointer-events-none"
          )}
        >
          <div
            class={cn(
              "flex text-nowrap gap-1 overflow-clip flex-shrink",
              expandTags && "flex-wrap"
            )}
          >
            {#each dataStore.tag_summary.filter((t) => t.tag.taxonomy.name !== "Genre") as tag}
              {@const active = isTagSelected(tag.tag.label)}
              <TagBadge
                label={tag.tag.label}
                count={tag.count}
                {active}
                onclick={() => toggleTag(tag.tag.label)}
              />
            {/each}
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onclick={() => {
            expandTags = !expandTags;
            tick().then(() => {
              tagsDrawerRef.style.height = tagsContainerRef.offsetHeight + "px";
            });
          }}
          class="shrink-0 h-6 px-5 text-muted-foreground"
        >
          <ChevronDown
            size="18"
            class={cn(
              "transition-transform ease-in-out",
              expandTags ? "rotate-[-180deg]" : ""
            )}
          /></Button
        >
      </div>
    </div>

    <div class="flex justify-between items-end gap-2">
      <div class="text-muted-foreground text-xs flex-grow">
        {dataStore.total_records.toLocaleString()} results
      </div>
      <GenreSelect />
      <SortSelect
        bind:sort={queryStore.sort}
        onselect={fetchAssets}
        onshuffle={() => {
          queryStore.random_seed = randomSeed();
          queryStore.sort = "random";
          fetchAssets();
        }}
        order={queryStore.order}
      />
    </div>

    <div class="flex flex-col gap-2">
      <Separator />
      <div class="flex gap-2 items-center justify-between overflow-clip px-2">
        <div class="w-12 flex-shrink-0 text-xs text-muted-foreground">Pack</div>
        <div class="w-12 flex-shrink-0 text-xs text-muted-foreground"></div>
        <SortHeader
          value="name"
          label="Filename"
          sort={queryStore.sort}
          order={queryStore.order}
          onsort={updateSort}
          class="min-w-32 w-96 flex-[3_1_auto]"
        />
        <div class="min-w-32 w-[150px] flex-grow md:block hidden"></div>
        <SortHeader
          value="duration"
          label="Time"
          sort={queryStore.sort}
          order={queryStore.order}
          onsort={updateSort}
          class="flex-shrink-0 w-14 flex-grow"
        />
        <SortHeader
          value="key"
          label="Key"
          sort={queryStore.sort}
          order={queryStore.order}
          onsort={updateSort}
          class="flex-shrink-0 w-14 flex-grow"
        />
        <SortHeader
          value="bpm"
          label="BPM"
          sort={queryStore.sort}
          order={queryStore.order}
          onsort={updateSort}
          class="flex-shrink-0 w-14 flex-grow"
        />
      </div>
      <ProgressLoading loading={loading.assets || loading.waveformsCount > 0} />
    </div>
  </div>
  <ScrollArea
    class="px-4 flex-grow before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-4 before:bg-gradient-to-t before:from-transparent before:to-background before:pointer-events-none after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-4 after:bg-gradient-to-b after:from-transparent after:to-background after:pointer-events-none"
    bind:viewportRef
  >
    <div class="flex flex-col py-2 size-full">
      {#each dataStore.sampleAssets as sampleAsset, index}
        {@const selected = globalAudio.currentAsset?.uuid == sampleAsset.uuid}
        <SampleListEntry
          {sampleAsset}
          {selected}
          playing={selected && !globalAudio.paused}
        />
        {#if index < dataStore.sampleAssets.length - 1}
          <div
            class={selected || index + 1 == selectedSampleIndex ? "px-2" : ""}
          >
            <Separator />
          </div>
        {/if}
      {:else}
        <div
          class="flex flex-col gap-2 justify-center items-center size-full text-muted-foreground"
        >
          {#if loading.fetchError}
            <div
              class="flex flex-col items-center justify-center gap-3 p-6 text-center max-w-md my-auto"
            >
              <div class="p-3 rounded-full bg-destructive/10 text-destructive mb-1">
                <AlertTriangle size="32" />
              </div>
              <p class="font-bold text-lg text-foreground">Failed to Load Samples</p>
              <p class="text-sm text-muted-foreground">
                Unable to fetch data from Splice API. Please check your network connection or try again.
              </p>
              {#if loading.fetchError.message}
                <div
                  class="px-3 py-1.5 rounded-md bg-muted text-xs font-mono text-muted-foreground border border-border/50 max-w-full truncate"
                >
                  {loading.fetchError.message}
                </div>
              {/if}
              <Button onclick={fetchAssets} variant="outline" class="gap-2 mt-2">
                <RotateCw size="15" />
                Retry Connection
              </Button>
            </div>
          {:else if loading.beforeFirstLoad}
            <Smile size="48" />
            <p class="font-bold text-xl">Hey there!</p>
            <p class="text-sm">Make some cool music, will ya?</p>
          {:else}
            <Search size="48" />
            <p class="font-bold text-xl">No results</p>
            <p class="text-sm">Try different keywords</p>
          {/if}
        </div>
      {/each}
      {#if loading.fetchError && dataStore.sampleAssets.length > 0}
        <div
          class="flex flex-col py-6 px-4 gap-2 justify-center items-center text-center text-muted-foreground border-t border-border/40 mt-4 bg-muted/20"
        >
          <div class="flex items-center gap-2 text-destructive font-semibold text-sm">
            <AlertTriangle size="18" />
            <span>Failed to load more samples</span>
          </div>
          {#if loading.fetchError.message}
            <p class="text-xs font-mono text-muted-foreground max-w-md truncate">
              {loading.fetchError.message}
            </p>
          {/if}
          <Button onclick={fetchAssets} variant="outline" size="sm" class="gap-2 mt-1">
            <RotateCw size="14" />
            Retry
          </Button>
        </div>
      {/if}
    </div>
  </ScrollArea>
  <AudioPlayer onprev={onPrevClick} onnext={onNextClick} />
</main>
