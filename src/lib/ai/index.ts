/**
 * ZenCode V2 - AI Module Exports
 */

export { chat, tryParseJsonResponse, repairTruncatedJson, parseAiJson } from './anthropic'
export {
  generateScaffold,
  generateMissingFiles,
  generateValidationFixes,
  generateTypeScriptFixes,
  generateWiring,
  fixPackageJson,
} from './scaffold'
export type {
  ScaffoldInput,
  MissingFilesInput,
  ValidationFixInput,
  TypeScriptFixInput,
  WiringInput,
} from './scaffold'
export {
  generateEmbedding,
  cosineSimilarity,
  findSimilar,
  EMBEDDING_DIMENSION,
} from './embeddings'
