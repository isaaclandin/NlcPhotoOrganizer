import type { LucideIcon } from "lucide-react";
import Card from "./Card";
import Button from "./Button";

interface DropboxStatePanelProps {
  icon: LucideIcon;
  tone?: "neutral" | "error";
  spin?: boolean;
  heading: string;
  message?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export default function DropboxStatePanel({
  icon: Icon,
  tone = "neutral",
  spin = false,
  heading,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: DropboxStatePanelProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <Card className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            tone === "error" ? "bg-rose-100 text-rose-600" : "bg-sage-100 text-sage-500"
          }`}
        >
          <Icon size={22} className={spin ? "animate-spin" : undefined} />
        </span>
        <h3 className="text-sm font-semibold text-ink-900">{heading}</h3>
        {message && <p className="text-xs text-ink-500">{message}</p>}
        {(primaryLabel || secondaryLabel) && (
          <div className="mt-1 flex items-center gap-2">
            {secondaryLabel && (
              <Button variant="secondary" onClick={onSecondary} className="!px-3.5 !py-2 text-xs">
                {secondaryLabel}
              </Button>
            )}
            {primaryLabel && (
              <Button variant="primary" onClick={onPrimary} className="!px-3.5 !py-2 text-xs">
                {primaryLabel}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
