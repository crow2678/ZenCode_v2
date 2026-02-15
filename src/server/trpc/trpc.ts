import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import type { Context } from './context'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
      },
    })
  })
)

export const orgProcedure = protectedProcedure.use(
  t.middleware(({ ctx, next }) => {
    // For V2, we'll use userId as orgId if no org is set
    // This allows personal projects
    const orgId = ctx.orgId || ctx.userId
    return next({
      ctx: {
        ...ctx,
        orgId,
      },
    })
  })
)

export { createContext } from './context'
export type { Context } from './context'
