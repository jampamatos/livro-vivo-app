import {
  buildAvatarCropSelection,
  buildAvatarPreviewImageStyle,
  clampAvatarCropOffsets,
} from "../src/utils/avatarCrop";

describe("avatarCrop", () => {
  it("gera recorte central quadrado por padrão", () => {
    const selection = buildAvatarCropSelection(
      {
        imageWidth: 800,
        imageHeight: 600,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      },
      280
    );

    expect(selection).toEqual({
      x: 100,
      y: 0,
      size: 600,
      imageWidth: 800,
      imageHeight: 600,
    });
  });

  it("limita offsets ao tamanho realmente arrastável", () => {
    const offsets = clampAvatarCropOffsets(
      {
        imageWidth: 1200,
        imageHeight: 800,
        zoom: 1,
        offsetX: 999,
        offsetY: -999,
      },
      300
    );

    expect(offsets.x).toBeGreaterThan(0);
    expect(offsets.y).toBeLessThanOrEqual(0);
    expect(Math.abs(offsets.y)).toBeLessThanOrEqual(1);
  });

  it("gera estilo de preview coerente com o recorte salvo", () => {
    const style = buildAvatarPreviewImageStyle(80, {
      x: 100,
      y: 0,
      size: 600,
      imageWidth: 800,
      imageHeight: 600,
    });

    expect(style.width).toBeCloseTo(106.666, 2);
    expect(style.height).toBe(80);
    expect(style.left).toBeCloseTo(-13.333, 2);
    expect(style.top).toBeCloseTo(0, 5);
  });
});
