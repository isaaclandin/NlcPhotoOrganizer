import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  icon?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-forest-600 text-cream-50 hover:bg-forest-700 shadow-soft border border-forest-700/40",
  secondary:
    "bg-cream-50 text-ink-700 hover:bg-beige-200 border border-beige-300",
  ghost: "bg-transparent text-ink-700 hover:bg-beige-200 border border-transparent",
  danger:
    "bg-cream-50 text-ink-700 hover:bg-rose-50 hover:text-rose-700 border border-beige-300",
};

export default function Button({
  children,
  variant = "secondary",
  icon,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
