import { createTRPCRouter } from './trpc'
import {
  projectRouter,
  requirementRouter,
  blueprintRouter,
  workOrderRouter,
  assemblyRouter,
  documentRouter,
  orgSettingsRouter,
  tokenUsageRouter,
} from './procedures'

export const appRouter = createTRPCRouter({
  project: projectRouter,
  requirement: requirementRouter,
  blueprint: blueprintRouter,
  workOrder: workOrderRouter,
  assembly: assemblyRouter,
  document: documentRouter,
  orgSettings: orgSettingsRouter,
  tokenUsage: tokenUsageRouter,
})

export type AppRouter = typeof appRouter
