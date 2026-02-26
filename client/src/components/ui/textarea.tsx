import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(
  (
    {
      className,
      autoComplete = "off",
      autoCorrect = "off",
      autoCapitalize = "none",
      spellCheck = false,
      ...props
    },
    ref
  ) => {
  return (
    <textarea
      autoComplete={autoComplete}
      autoCorrect={autoCorrect}
      autoCapitalize={autoCapitalize}
      spellCheck={spellCheck}
      data-form-type="other"
      data-lpignore="true"
      data-1p-ignore="true"
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
}
)
Textarea.displayName = "Textarea"

export { Textarea }
