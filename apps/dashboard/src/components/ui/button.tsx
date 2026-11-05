import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Pill buttons: fully rounded, a soft inset highlight on top, a shade underneath and a
// diffuse drop shadow. Raised variants lift 2px on hover and settle back on press.
const raised =
  "shadow-pill hover:-translate-y-0.5 hover:shadow-pill-hover active:translate-y-0 active:shadow-pill active:scale-[0.98]"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-[transform,box-shadow,background-color,color,opacity] duration-150 ease-out outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground hover:bg-primary-hover ${raised}`,
        destructive: `bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/70 dark:focus-visible:ring-destructive/40 ${raised}`,
        outline: `border border-border bg-card text-foreground hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50 ${raised}`,
        secondary: `bg-secondary text-secondary-foreground hover:bg-secondary-hover ${raised}`,
        ghost: "hover:bg-accent hover:text-accent-foreground active:scale-[0.97] dark:hover:bg-accent/60",
        link: "rounded-sm text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 has-[>svg]:px-4",
        xs: "h-7 gap-1 px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3.5 text-[13px] has-[>svg]:px-3",
        lg: "h-11 px-7 text-[15px] has-[>svg]:px-5",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      // Default to "button", not the browser's "submit": components rendered
      // inside a settings <form> (NavigationManager, CustomDomainCard) were
      // saving the whole parent form on every click. Real submit buttons pass
      // type="submit" explicitly. asChild leaves type to the child element.
      type={asChild ? type : (type ?? "button")}
      {...props}
    />
  )
}

export { Button, buttonVariants }
