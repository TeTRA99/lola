// Manual mock — Jest auto-uses this for the node_modules package so the native
// link isn't attempted under Node. Tests that exercise embeddings can override
// ImageEmbeddingsModule.fromModelName per-case.

class ImageEmbeddingsModule {
  static fromModelName = jest.fn(async () => new ImageEmbeddingsModule());
  static fromCustomModel = jest.fn(async () => new ImageEmbeddingsModule());
  forward = jest.fn(async () => new Float32Array(512));
}

module.exports = {
  isAvailable: true,
  initExecutorch: jest.fn(),
  cleanupExecutorch: jest.fn(),
  ImageEmbeddingsModule,
  CLIP_VIT_BASE_PATCH32_IMAGE_QUANTIZED: {
    modelName: 'clip-vit-base-patch32-image-quantized',
    modelSource: 'mock://clip.pte',
  },
};
