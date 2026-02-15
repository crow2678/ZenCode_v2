/**
 * ZenCode V2 - Project Template Registry
 *
 * Pre-built templates for common project types.
 */

import { saasTemplate } from './saas'
import { ecommerceTemplate } from './ecommerce'
import { blogCmsTemplate } from './blog-cms'

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  icon: string
  stackId: string
  prdText: string
  features: string[]
  suggestedAuthType: 'none' | 'clerk' | 'auth0' | 'firebase' | 'custom'
}

const templates: ProjectTemplate[] = [
  saasTemplate,
  ecommerceTemplate,
  blogCmsTemplate,
]

export function getTemplates(): ProjectTemplate[] {
  return templates
}

export function getTemplate(id: string): ProjectTemplate | undefined {
  return templates.find((t) => t.id === id)
}
