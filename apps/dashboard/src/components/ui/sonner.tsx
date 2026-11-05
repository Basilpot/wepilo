import { useContext } from "react"
import { ThemeContext } from "@/components/theme-provider"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "@/components/icons"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useContext(ThemeContext)

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{ classNames: { toast: "shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]! font-medium!", description: "text-muted-foreground! font-normal!" } }}
      icons={{
        success: (
          <CircleCheckIcon className="size-[18px] animate-pop-in text-primary" />
        ),
        info: (
          <InfoIcon className="size-[18px] text-muted-foreground" />
        ),
        warning: (
          <TriangleAlertIcon className="size-[18px] animate-nudge text-attention" />
        ),
        error: (
          <OctagonXIcon className="size-[18px] animate-nudge text-destructive" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "1rem",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
