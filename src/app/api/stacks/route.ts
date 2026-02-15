/**
 * ZenCode V2 - Stacks API
 *
 * List all available stacks
 */

import { NextResponse } from 'next/server'
import { StackFactory } from '@/stacks'

export async function GET() {
  const stacks = StackFactory.listStacks()

  return NextResponse.json({
    stacks,
    default: StackFactory.getDefault().id,
    count: stacks.length,
  })
}
