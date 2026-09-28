import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-b from-accent to-accent-2 text-white shadow-[0_1px_0_0_rgb(255_255_255/0.25)_inset,0_6px_18px_-8px_rgb(var(--accent)/0.9)] hover:brightness-110 active:brightness-95",
        secondary: "border border-line bg-surface-2 text-fg hover:border-accent/50 hover:bg-surface-2/80",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg",
        outline: "border border-line text-fg hover:bg-surface-2",
        danger: "border border-bad/40 text-bad hover:bg-bad/10",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4",
        lg: "h-11 px-5 text-[15px]",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
