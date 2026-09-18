import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "cn"

/**
 * Tabs — thin wrapper over base-ui's accessible Tabs, in the same shape as the other `components/ui`
 * primitives. base-ui supplies the ARIA roles (`tablist` / `tab` / `tabpanel`) and the roving-focus
 * keyboard pattern: ArrowLeft/ArrowRight move between tabs while the tablist has focus. That is also
 * why the global shortcut handler has to yield to a focused `[role="tablist"]` — see
 * `use-stowage-keyboard-shortcuts.ts`.
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn("tabs-list", className)} {...props} />
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return <TabsPrimitive.Tab data-slot="tabs-trigger" className={cn("tabs-trigger", className)} {...props} />
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return <TabsPrimitive.Panel data-slot="tabs-content" className={cn("tabs-content", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
