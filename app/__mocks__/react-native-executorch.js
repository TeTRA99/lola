// Manual mock — Jest auto-uses this for the node_modules package so the native
// link isn't attempted under Node. Tests that exercise embeddings / on-device
// LLMs can override the static factories per-case.

class ImageEmbeddingsModule {
  static fromModelName = jest.fn(async () => new ImageEmbeddingsModule());
  static fromCustomModel = jest.fn(async () => new ImageEmbeddingsModule());
  forward = jest.fn(async () => new Float32Array(512));
}

// On-device LLM (text + multimodal VLM). generate()/sendMessage() return a stub
// narration so adapter logic (toLolaResponse, error mapping) can be unit-tested.
class LLMModule {
  static fromModelName = jest.fn(async () => new LLMModule());
  static fromCustomModel = jest.fn(async () => new LLMModule());
  configure = jest.fn();
  generate = jest.fn(async () => 'mock narration');
  sendMessage = jest.fn(async () => [{ role: 'assistant', content: 'mock narration' }]);
  forward = jest.fn(async () => 'mock narration');
  interrupt = jest.fn();
  delete = jest.fn();
  getGeneratedTokenCount = jest.fn(() => 0);
  getPromptTokensCount = jest.fn(() => 0);
  getTotalTokensCount = jest.fn(() => 0);
}

const accessor = obj => () => obj;

const models = {
  llm: {
    lfm2_5_vl_450m: accessor({
      modelName: 'lfm2.5-vl-450m-quantized',
      modelSource: 'mock://vl450.pte',
      tokenizerSource: 'mock://tok.json',
      tokenizerConfigSource: 'mock://tokcfg.json',
      capabilities: ['vision'],
    }),
    lfm2_5_vl_1_6b: accessor({
      modelName: 'lfm2.5-vl-1.6b-quantized',
      modelSource: 'mock://vl16b.pte',
      tokenizerSource: 'mock://tok.json',
      tokenizerConfigSource: 'mock://tokcfg.json',
      capabilities: ['vision'],
    }),
    qwen3_0_6b: accessor({
      modelName: 'qwen3-0.6b-quantized',
      modelSource: 'mock://qwen3.pte',
      tokenizerSource: 'mock://tok.json',
      tokenizerConfigSource: 'mock://tokcfg.json',
    }),
    llama3_2_1b: accessor({
      modelName: 'llama-3.2-1b',
      modelSource: 'mock://llama.pte',
      tokenizerSource: 'mock://tok.json',
      tokenizerConfigSource: 'mock://tokcfg.json',
    }),
    qwen2_5_0_5b: accessor({
      modelName: 'qwen2.5-0.5b-quantized',
      modelSource: 'mock://qwen25-05.pte',
      tokenizerSource: 'mock://tok.json',
      tokenizerConfigSource: 'mock://tokcfg.json',
    }),
    qwen2_5_1_5b: accessor({
      modelName: 'qwen2.5-1.5b-quantized',
      modelSource: 'mock://qwen25-15.pte',
      tokenizerSource: 'mock://tok.json',
      tokenizerConfigSource: 'mock://tokcfg.json',
    }),
    smollm2_1_360m: accessor({
      modelName: 'smollm2.1-360m-quantized',
      modelSource: 'mock://smol.pte',
      tokenizerSource: 'mock://tok.json',
      tokenizerConfigSource: 'mock://tokcfg.json',
    }),
  },
  object_detection: {
    yolo26n: accessor({ modelName: 'yolo26n', modelSource: 'mock://yolo.pte' }),
  },
};

module.exports = {
  isAvailable: true,
  initExecutorch: jest.fn(),
  cleanupExecutorch: jest.fn(),
  ImageEmbeddingsModule,
  LLMModule,
  models,
  CLIP_VIT_BASE_PATCH32_IMAGE_QUANTIZED: {
    modelName: 'clip-vit-base-patch32-image-quantized',
    modelSource: 'mock://clip.pte',
  },
};
