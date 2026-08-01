<script lang="ts">
    import { cn } from "$lib/utils.js"
    import ChevronDown from "lucide-svelte/icons/chevron-down"
    import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down"
    import Button, {
        type ButtonProps,
    } from "$lib/components/ui/button/button.svelte"
    import type { AssetSortType, SortOrder } from "$lib/splice/types"

    let {
        class: className,
        value,
        label,
        sort,
        order,
        onsort,
    }: {
        class?: string
        value: AssetSortType
        label: string
        sort: AssetSortType
        order: SortOrder
        onsort: (newSort: AssetSortType) => void
    } = $props()

    const active = $derived(value == sort)
</script>

<div class={cn("flex items-center min-w-0", className)}>
    <Button
        variant="ghost"
        size="sm"
        class={cn(
            "gap-1 px-0 h-auto font-medium text-xs hover:bg-transparent hover:text-primary focus-visible:ring-0",
            active ? "text-primary" : "text-muted-foreground"
        )}
        onclick={() => onsort(value)}
    >
        <span>{label}</span>
        {#if active}
            <ChevronDown
                size="14"
                class={cn(
                    "transition-transform ease-in-out shrink-0",
                    order == "ASC" ? "rotate-[-180deg]" : ""
                )}
            />
        {:else}
            <ChevronsUpDown size="12" class="shrink-0 opacity-50" />
        {/if}
    </Button>
</div>
