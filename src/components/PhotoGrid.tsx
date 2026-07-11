import PhotoTile from "./PhotoTile";
import type { DropboxFileItem } from "../services/dropboxTypes";
import type { ThumbnailResultMap } from "../services/dropboxService";

interface PhotoGridProps {
  photos: DropboxFileItem[];
  thumbnails: ThumbnailResultMap;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  columns: number;
}

export default function PhotoGrid({ photos, thumbnails, selectedIds, onToggle, columns }: PhotoGridProps) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {photos.map((photo) => (
        <PhotoTile
          key={photo.id}
          photo={photo}
          thumbnail={thumbnails.get(photo.id) ?? { status: "loading" }}
          selected={selectedIds.has(photo.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
