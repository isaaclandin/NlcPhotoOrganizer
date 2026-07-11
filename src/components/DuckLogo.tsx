import duckLogoReference from "../assets/design/processed/duck_logo_reference.png";

interface DuckLogoProps {
  size?: number;
  className?: string;
}

export default function DuckLogo({ size = 44, className = "" }: DuckLogoProps) {
  return (
    <img
      src={duckLogoReference}
      alt="NLC duck mascot"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 select-none object-contain ${className}`}
      draggable={false}
    />
  );
}
