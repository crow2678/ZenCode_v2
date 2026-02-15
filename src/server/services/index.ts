/**
 * ZenCode V2 - Services Barrel Export
 */

// Requirement/PRD Service
export {
  generateRequirementPRD,
  enhanceRequirementPRD,
  extractFeaturesFromPRD,
  type GeneratePRDInput,
  type GeneratePRDResult,
  type EnhancePRDInput,
  type ExtractFeaturesInput,
  type PRDContent,
  type Feature,
} from './requirement'

// Blueprint Service
export {
  generateBlueprintFromRequirement,
  type GenerateBlueprintInput,
  type BlueprintResult,
  type ModelDefinition,
  type ServiceDefinition,
  type RouteDefinition,
  type ComponentDefinition,
  type Architecture,
} from './blueprint'

// Work Orders Service
export {
  generateWorkOrdersFromBlueprint,
  updateWorkOrderStatus,
  type GenerateWorkOrdersInput,
  type GenerateWorkOrdersResult,
  type GeneratedWorkOrder,
  type WorkOrderFile,
  type UpdateWorkOrderStatusInput,
} from './work-orders'

// Agent Service
export {
  executeWorkOrderWithAgent,
  executeAllWorkOrders,
  refineWorkOrderCode,
  type ExecuteWorkOrderInput,
  type ExecuteWorkOrderResult,
  type ExecuteAllWorkOrdersInput,
  type ExecuteAllWorkOrdersResult,
  type RefineCodeInput,
  type RefineCodeResult,
} from './agent'

// Assembly Service
export {
  assembleProject,
  getAssemblyForBlueprint,
  getAssemblyById,
  type AssembleProjectInput,
} from './assembly'

// Document Service
export {
  processDocument,
  deleteDocument,
  listDocuments,
  getDocumentContext,
  type ProcessDocumentInput,
  type DeleteDocumentInput,
  type GetDocumentContextInput,
} from './document'
