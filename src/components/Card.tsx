import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export default function Card({ children, className = "", padded = true, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-beige-300/60 bg-beige-100 shadow-card ${
        padded ? "p-5" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
