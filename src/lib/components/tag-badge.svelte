<script lang="ts">
    import { cn } from "$lib/utils"
    import Button from "$lib/components/ui/button/button.svelte"
    import type { MouseEventHandler } from "svelte/elements"
    import * as Tooltip from "$lib/components/ui/tooltip"

    let {
        class: className,
        active = false,
        label,
        variant = "default",
        count,
        onclick,
    }: {
        class?: string
        active?: boolean
        label: string
        variant?: "default" | "ghost"
        count: number
        onclick: MouseEventHandler<HTMLButtonElement> &
            MouseEventHandler<HTMLAnchorElement>
    } = $props()
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger class="focus:outline-none" tabindex={-1}>
            <Button
                class={cn(
                    "px-2 min-w-0 h-6 justify-center shrink-0",
                    !active && "text-muted-foreground",
                    variant == "ghost" &&
                        "text-muted-foreground hover:bg-secondary/80 border-transparent hover:text-accent-foreground",
                    className
                )}
                variant={active
                    ? "default"
                    : variant == "default"
                      ? "outline"
                      : "ghost"}
                {onclick}
                >{label}
            </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>
            <p>{count} Samples</p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
