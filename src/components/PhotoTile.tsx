import { Check, ImageOff } from "lucide-react";
import type { DropboxFileItem } from "../services/dropboxTypes";
import type { ThumbnailState } from "../services/dropboxService";

interface PhotoTileProps {
  photo: DropboxFileItem;
  thumbnail: ThumbnailState;
  selected: boolean;
  onToggle: (id: string) => void;
}

export default function PhotoTile({ photo, thumbnail, selected, onToggle }: PhotoTileProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(photo.id)}
      className={`group relative aspect-[4/3] w-full overflow-hidden rounded-2xl text-left shadow-card transition-all duration-150 focus:outline-none ${
        selected
          ? "ring-[3px] ring-forest-600 ring-offset-2 ring-offset-cream-50"
          : "ring-1 ring-beige-300/70 hover:ring-sage-300"
      }`}
    >
      {thumbnail.status === "ready" ? (
        <img
          src={thumbnail.src}
          alt={photo.name}
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover transition-transform duration-200 group-hover:scale-[1.04]"
        />
      ) : thumbnail.status === "loading" ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-beige-200 via-cream-100 to-beige-200" />
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-sage-100 via-cream-100 to-beige-200" />
          <div className="absolute inset-0 flex items-center justify-center pb-4">
            <ImageOff size={26} strokeWidth={1.5} className="text-sage-400/70" />
          </div>
          <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2 pt-2">
            <p className="truncate text-[10px] font-medium text-ink-500">{photo.name}</p>
          </div>
        </>
      )}

      {thumbnail.status === "ready" && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/55 via-ink-900/10 to-transparent px-2.5 pb-2 pt-8 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <p className="truncate text-[11px] font-medium text-white drop-shadow">{photo.name}</p>
        </div>
      )}

      {selected && (
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-forest-600 shadow-soft ring-2 ring-white/80">
          <Check size={14} className="text-cream-50" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
