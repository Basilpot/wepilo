
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit max-w-full items-center justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-full p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-10 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/** Tab strip with a thumb that glides to the active tab instead of jumping. */
function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = React.useState<{ x: number; w: number } | null>(null)

  React.useLayoutEffect(() => {
    const list = ref.current
    if (!list) return
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-state="active"]')
      setThumb(active ? { x: active.offsetLeft, w: active.offsetWidth } : null)
    }
    measure()
    const mo = new MutationObserver(measure)
    mo.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"], childList: true })
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => {
      mo.disconnect()
      ro.disconnect()
    }
  }, [])

  return (
    <TabsPrimitive.List
      ref={ref}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), "relative isolate", className)}
      {...props}
    >
      {thumb && (
        <span
          aria-hidden
          data-slot="tabs-thumb"
          className={cn(
            "pointer-events-none absolute -z-10 transition-[translate,width] duration-[420ms] ease-[var(--ease-out-expo)] motion-reduce:transition-none",
            variant === "line"
              ? "bottom-0 h-0.5 rounded-full bg-primary"
              : "top-[3px] bottom-[3px] rounded-full bg-background shadow-[0_1px_2px_rgb(0_0_0/0.08),0_2px_8px_-2px_rgb(0_0_0/0.1)] dark:bg-input/40",
          )}
          style={{ translate: `${thumb.x}px 0`, width: thumb.w, left: 0 }}
        />
      )}
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50  group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "data-[state=active]:text-primary",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 ",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
