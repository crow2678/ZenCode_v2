/**
 * ZenCode V2 - Blog/CMS Template
 */

import type { ProjectTemplate } from './index'

export const blogCmsTemplate: ProjectTemplate = {
  id: 'blog-cms',
  name: 'Blog / CMS',
  description: 'Content management system with rich text editor, categories, tags, media library, and SEO.',
  icon: 'pen-square',
  stackId: 'nextjs-mongodb',
  suggestedAuthType: 'clerk',
  features: [
    'Rich text editor',
    'Categories & tags',
    'Media library',
    'Comment system',
    'SEO optimization',
    'Draft/publish workflow',
    'Author profiles',
    'RSS feed',
  ],
  prdText: `Build a blog and content management system with the following features:

1. **Rich Text Editor**: A WYSIWYG editor for creating and editing posts. Support headings, bold/italic, lists, code blocks, images, and embedded media. Posts have a title, slug, excerpt, featured image, and body content.

2. **Categories & Tags**: Organize posts with categories (hierarchical) and tags (flat). Each category has a name, slug, and description. Posts can belong to multiple categories and have multiple tags.

3. **Media Library**: Upload and manage images and files. Support drag-and-drop upload, image resizing, and alt text. Media can be organized in folders.

4. **Comment System**: Authenticated users can comment on posts. Support threaded replies (nested comments). Comments can be moderated (approve, reject, spam).

5. **SEO Optimization**: Auto-generate meta titles and descriptions. Support custom OG images, canonical URLs, and structured data (JSON-LD). Generate XML sitemap.

6. **Draft/Publish Workflow**: Posts have statuses: draft, scheduled, published, archived. Support scheduling posts for future publication. Show post revision history.

7. **Author Profiles**: Each author has a profile with bio, avatar, social links, and list of published posts. Support multiple authors per post.

8. **RSS Feed**: Auto-generated RSS feed for the blog. Support category-specific feeds. Include full post content or excerpt based on settings.`,
}
