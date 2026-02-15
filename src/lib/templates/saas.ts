/**
 * ZenCode V2 - SaaS Starter Template
 */

import type { ProjectTemplate } from './index'

export const saasTemplate: ProjectTemplate = {
  id: 'saas',
  name: 'SaaS Starter',
  description: 'Multi-tenant SaaS with user management, team collaboration, subscriptions, and settings.',
  icon: 'building',
  stackId: 'nextjs-mongodb',
  suggestedAuthType: 'clerk',
  features: [
    'User authentication & profiles',
    'Team/organization management',
    'Subscription billing (Stripe)',
    'Role-based access control',
    'Settings & preferences',
    'Dashboard with analytics',
    'Notification system',
    'API rate limiting',
  ],
  prdText: `Build a multi-tenant SaaS application with the following features:

1. **User Management**: Users can sign up, log in, manage their profile, and upload an avatar. Support email/password and social auth (Google, GitHub).

2. **Team/Organization Management**: Users can create organizations, invite team members via email, assign roles (owner, admin, member), and manage team settings.

3. **Subscription & Billing**: Integration with Stripe for subscription management. Support free, pro, and enterprise tiers. Users can view invoices, update payment methods, and manage their subscription.

4. **Dashboard**: A main dashboard showing key metrics (active users, revenue, usage), recent activity feed, and quick action shortcuts.

5. **Settings**: User settings (profile, notifications, security), organization settings (general, billing, members, API keys), and admin settings.

6. **Notifications**: In-app notification center with real-time updates. Support email notifications for important events (team invites, billing alerts).

7. **API Keys**: Organizations can generate API keys for programmatic access. Keys should be revocable and have configurable rate limits.

8. **Audit Log**: Track all important actions (user logins, settings changes, team member changes) with an searchable audit log per organization.`,
}
