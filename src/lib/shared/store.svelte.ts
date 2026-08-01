import { CategoryList, querySplice, SamplesSearch } from "$lib/splice/api"
import { descrambleSample } from "$lib/splice/descrambler"
import type {
    AssetCategorySlug,
    AssetSortType,
    ChordType,
    Key,
    SampleAsset,
    SamplesSearchResponse,
    SortOrder,
    TagSummaryEntry,
} from "$lib/splice/types"
import { globalAudio } from "./audio.svelte"
import { loading as globalLoading } from "./loading.svelte"
import { tabManager } from "./tabs.svelte"

// Combined loading proxy
export const loading = new Proxy({} as any, {
    get(_, prop) {
        if (prop in globalLoading) {
            return globalLoading[prop as keyof typeof globalLoading]
        }
        return tabManager.activeTab.loadingState[prop as keyof typeof tabManager.activeTab.loadingState]
    },
    set(_, prop, value) {
        if (prop in globalLoading) {
            (globalLoading as any)[prop] = value
            return true
        }
        (tabManager.activeTab.loadingState as any)[prop] = value
        return true
    }
}) as typeof globalLoading & {
    assets: boolean
    beforeFirstLoad: boolean
    fetchError: Error | null
}

import { DEFAULT_SORT, PER_PAGE, randomSeed } from "./constants"

export { DEFAULT_SORT, PER_PAGE, randomSeed }

// Global shared state for genres (not per-tab)
const globalData = $state({
    all_genres: [] as { uuid: string; label: string }[],
})

// Proxy for dataStore to point to active tab's dataState
export const dataStore = new Proxy({} as any, {
    get(_, prop) {
        if (prop === "all_genres") return globalData.all_genres
        return tabManager.activeTab.dataState[prop as keyof typeof tabManager.activeTab.dataState]
    },
    set(_, prop, value) {
        if (prop === "all_genres") {
            globalData.all_genres = value
            return true
        }
        (tabManager.activeTab.dataState as any)[prop] = value
        return true
    }
}) as {
    sampleAssets: SampleAsset[]
    tags: string[]
    tag_summary: TagSummaryEntry[]
    all_genres: { uuid: string; label: string }[]
    total_records: number
}

export const keys = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
] as const
export const chord_types = ["major", "minor"]

// Proxy for queryStore to point to active tab's queryState
export const queryStore = new Proxy({} as any, {
    get(_, prop) {
        return tabManager.activeTab.queryState[prop as keyof typeof tabManager.activeTab.queryState]
    },
    set(_, prop, value) {
        (tabManager.activeTab.queryState as any)[prop] = value
        return true
    }
}) as {
    query: string
    sort: AssetSortType
    random_seed: string
    order: SortOrder
    page: number
    asset_category_slug: AssetCategorySlug | null
    bpm: string | null
    min_bpm: number | null
    max_bpm: number | null
    key: Key | null
    chord_type: ChordType | null
    parent_asset_uuid: string | null
    packName: string | null
}

// The query identity is the part of the query that uniquely identifies the returned data
// It is used to determine if the fetched data should replace the current data, be appended to it, or be ignored
const queryIdentity = $derived({
    query: queryStore.query,
    sort: queryStore.sort,
    order: queryStore.order,
    random_seed: queryStore.random_seed,
    tags: dataStore.tags,
    asset_category_slug: queryStore.asset_category_slug,
    bpm: queryStore.bpm?.toString(),
    min_bpm: queryStore.min_bpm,
    max_bpm: queryStore.max_bpm,
    key: queryStore.key,
    chord_type: queryStore.chord_type,
    parent_asset_uuid: queryStore.parent_asset_uuid,
})

export const storeCallbacks = $state({
    onbeforedataupdate: null as (() => void) | null,
    onbeforetagsupdate: null as (() => void) | null,
})

let currentQueryIdentity: string = ""

export const fetchAllGenres = async () => {
    const categoriesToFetch = ["genres", "styles"]
    
    try {
        const results = await Promise.all(
            categoriesToFetch.map(tagCategory => querySplice(CategoryList, { tagCategory }))
        )

        const allGenres: { uuid: string; label: string }[] = []

        results.forEach((response, index) => {
            if (!response?.data?.categories) return
            const tagCategory = categoriesToFetch[index]
            const categories = response.data.categories.categories

            categories.forEach((cat: any) => {
                const processTags = (tags: any[]) => {
                    tags.forEach((tag: any) => {
                        // Avoid duplicates, prioritizing earlier categories (genres > styles)
                        if (!allGenres.some(g => g.label.toLowerCase() === tag.label.toLowerCase())) {
                            allGenres.push({ uuid: tag.uuid, label: tag.label })
                        }
                    })
                }

                if (cat.tags) processTags(cat.tags)
                if (cat.subcategories) {
                    cat.subcategories.forEach((sub: any) => {
                        if (sub.tags) processTags(sub.tags)
                    })
                }
            })
            console.info(`🎸 Loaded all ${tagCategory}`)
        })

        // This goes to globalData via the proxy
        dataStore.all_genres = allGenres
    } catch (error) {
        console.error("⚠️ Failed to fetch all genres", error)
    }
}

export const fetchAssets = () => {
    const identityBeforeFetch = JSON.stringify(queryIdentity)
    const isNewSearch = identityBeforeFetch != currentQueryIdentity
    
    if (isNewSearch) {
        storeCallbacks.onbeforedataupdate?.()
    }
    
    loading.assets = true
    querySplice(SamplesSearch, {
        ...queryIdentity,
        page: queryStore.page,
        limit: PER_PAGE,
        include_tag_summary: isNewSearch,
        parent_asset_uuid: queryStore.parent_asset_uuid,
    })
        .then((response) => {
            if (!response || !response.data || !response.data.assetsSearch) {
                throw new Error("Splice API request failed or returned invalid data.")
            }
            const searchResult = (response as SamplesSearchResponse).data
                .assetsSearch
            const identityAfterFetch = JSON.stringify(queryIdentity)
            
            // If the query params changed while fetching (e.g. user typed more), ignore
            // Note: This check relies on the *current* active tab's state. 
            // If user switched tabs, `queryIdentity` now refers to the NEW tab.
            // So this actually inadvertently protects against cross-tab pollution if the new tab has different query.
            
            if (identityBeforeFetch == identityAfterFetch) {
                if (identityBeforeFetch == currentQueryIdentity) {
                    dataStore.sampleAssets.push(...searchResult.items)
                    console.info("➕ Loaded more assets")
                } else {
                    // Prevent duplicates
                    dataStore.sampleAssets = searchResult.items.filter(
                        (asset) =>
                            !dataStore.sampleAssets.some(
                                (other) => other.uuid == asset.uuid
                            )
                    )
                    currentQueryIdentity = identityAfterFetch
                    queryStore.page = 1
                    console.info("🔄️ Loaded new assets")
                }
                dataStore.total_records = searchResult.response_metadata.records

                if (searchResult.tag_summary) {
                    storeCallbacks.onbeforetagsupdate?.()
                    dataStore.tag_summary = searchResult.tag_summary
                }

                loading.assets = false
                loading.beforeFirstLoad = false

                loading.fetchError = null
            } else {
                console.info("🕜 Ignored stale assets")
            }
        })
        .catch((error: Error) => {
            console.error("⚠️ Failed to fetch assets", error)
            loading.fetchError = error
            loading.assets = false
        })
}

export function normalizeLabel(label: string) {
    let l = label.toLowerCase().trim()
    
    // Common Splice Aliases
    const aliases: Record<string, string> = {
        "r&b": "rnb",
        "r and b": "rnb",
        "drum and bass": "dnb",
        "drum & bass": "dnb",
        "lo-fi hip hop": "lofi hip hop",
        "lo-fi": "lofi",
    }

    if (aliases[l]) return aliases[l]
    
    // Fuzzier matching: remove special chars
    return l.replace(/[^a-z0-9]/g, "")
}

const selectedLabels = $derived.by(() => {
    const normalizedSelected = new Set<string>()
    const tagSet = new Set(dataStore.tags)

    dataStore.all_genres.forEach((g) => {
        if (tagSet.has(g.uuid)) normalizedSelected.add(normalizeLabel(g.label))
    })
    dataStore.tag_summary.forEach((entry) => {
        if (tagSet.has(entry.tag.uuid)) normalizedSelected.add(normalizeLabel(entry.tag.label))
    })

    return normalizedSelected
})


export function isTagSelected(label: string) {
    return selectedLabels.has(normalizeLabel(label))
}

export function toggleTag(label: string) {
    const targetNormalized = normalizeLabel(label)
    const uuids = new Set<string>()

    // Collect all known UUIDs that normalize to this label
    dataStore.all_genres.forEach((g) => {
        if (normalizeLabel(g.label) === targetNormalized) uuids.add(g.uuid)
    })
    dataStore.tag_summary.forEach((entry) => {
        if (normalizeLabel(entry.tag.label) === targetNormalized)
            uuids.add(entry.tag.uuid)
    })

    if (uuids.size === 0) return

    const anySelected = Array.from(uuids).some((uuid) =>
        dataStore.tags.includes(uuid)
    )

    if (anySelected) {
        // Remove all matching tags
        dataStore.tags = dataStore.tags.filter((tag) => !uuids.has(tag))
    } else {
        // Add the "best" UUID (preferring all_genres)
        const bestUuid =
            dataStore.all_genres.find(
                (g) => normalizeLabel(g.label) === targetNormalized
            )?.uuid ||
            dataStore.tag_summary.find(
                (entry) => normalizeLabel(entry.tag.label) === targetNormalized
            )?.tag.uuid
        if (bestUuid) {
            dataStore.tags.push(bestUuid)
        }
    }
    fetchAssets()
}
