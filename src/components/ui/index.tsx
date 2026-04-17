import React from "react";
import { cn } from "@/src/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("bg-white border text-brand-text rounded-[8px] overflow-hidden flex flex-col", className)} style={{ borderColor: 'var(--color-brand-border)' }} {...props} />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-[16px] py-[12px] border-b bg-[#fafafa] flex justify-between items-center", className)} style={{ borderColor: 'var(--color-brand-border)' }} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-[14px] font-semibold", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 overflow-auto", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-md border bg-white px-3 py-2 text-[13px] placeholder:text-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={{ borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-text)' }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" }>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-[6px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent disabled:pointer-events-none disabled:opacity-50",
          "px-[16px] py-[8px] text-[13px] cursor-pointer",
          variant === "default" && "bg-brand-accent text-white hover:opacity-90 border-none",
          variant === "outline" && "border bg-white hover:bg-gray-50 text-brand-text",
          variant === "ghost" && "hover:bg-[#eff6ff] text-brand-muted hover:text-brand-accent",
          className
        )}
        style={variant === "outline" ? { borderColor: 'var(--color-brand-border)' } : undefined}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-[11px] font-semibold uppercase tracking-[0.05em] text-brand-muted mb-1 block", className)} {...props} />
  )
);
Label.displayName = "Label";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-[13px] placeholder:text-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{ borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-text)' }}
      {...props}
    />
  )
);
Select.displayName = "Select";
