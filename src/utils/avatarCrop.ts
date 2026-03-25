export type AvatarCropSelection = {
  x: number;
  y: number;
  size: number;
  imageWidth: number;
  imageHeight: number;
};

export type AvatarCropDraft = {
  imageWidth: number;
  imageHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export const AVATAR_CROP_MIN_ZOOM = 1;
export const AVATAR_CROP_MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getAvatarCropMetrics(imageWidth: number, imageHeight: number, viewportSize: number, zoom: number) {
  const baseScale = Math.max(viewportSize / imageWidth, viewportSize / imageHeight);
  const scale = baseScale * zoom;
  const displayWidth = imageWidth * scale;
  const displayHeight = imageHeight * scale;
  const maxOffsetX = Math.max(0, (displayWidth - viewportSize) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - viewportSize) / 2);
  return {
    scale,
    displayWidth,
    displayHeight,
    maxOffsetX,
    maxOffsetY,
  };
}

export function clampAvatarCropOffsets(draft: AvatarCropDraft, viewportSize: number) {
  const metrics = getAvatarCropMetrics(draft.imageWidth, draft.imageHeight, viewportSize, draft.zoom);
  return {
    x: clamp(draft.offsetX, -metrics.maxOffsetX, metrics.maxOffsetX),
    y: clamp(draft.offsetY, -metrics.maxOffsetY, metrics.maxOffsetY),
  };
}

export function buildAvatarCropSelection(draft: AvatarCropDraft, viewportSize: number): AvatarCropSelection {
  const metrics = getAvatarCropMetrics(draft.imageWidth, draft.imageHeight, viewportSize, draft.zoom);
  const cropSize = clamp(Math.round(viewportSize / metrics.scale), 1, Math.min(draft.imageWidth, draft.imageHeight));
  const cropX = clamp(
    Math.round((draft.imageWidth - cropSize) / 2 - draft.offsetX / metrics.scale),
    0,
    Math.max(0, draft.imageWidth - cropSize)
  );
  const cropY = clamp(
    Math.round((draft.imageHeight - cropSize) / 2 - draft.offsetY / metrics.scale),
    0,
    Math.max(0, draft.imageHeight - cropSize)
  );

  return {
    x: cropX,
    y: cropY,
    size: cropSize,
    imageWidth: draft.imageWidth,
    imageHeight: draft.imageHeight,
  };
}

export function buildAvatarPreviewImageStyle(containerSize: number, crop: AvatarCropSelection) {
  const width = (crop.imageWidth / crop.size) * containerSize;
  const height = (crop.imageHeight / crop.size) * containerSize;
  const left = -((crop.x / crop.size) * containerSize);
  const top = -((crop.y / crop.size) * containerSize);
  return {
    position: "absolute" as const,
    width,
    height,
    left,
    top,
  };
}
