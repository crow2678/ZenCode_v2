/**
 * ZenCode V2 - E-commerce Template
 */

import type { ProjectTemplate } from './index'

export const ecommerceTemplate: ProjectTemplate = {
  id: 'ecommerce',
  name: 'E-commerce',
  description: 'Full-featured online store with product catalog, shopping cart, checkout, and order management.',
  icon: 'shopping-cart',
  stackId: 'nextjs-mongodb',
  suggestedAuthType: 'clerk',
  features: [
    'Product catalog with categories',
    'Shopping cart',
    'Checkout with Stripe',
    'Order management',
    'Inventory tracking',
    'Admin dashboard',
    'Customer reviews',
    'Search & filtering',
  ],
  prdText: `Build a full-featured e-commerce application with the following features:

1. **Product Catalog**: Display products with images, descriptions, pricing, and variants (size, color). Support categories and subcategories. Products have SKUs, inventory counts, and status (active, draft, archived).

2. **Shopping Cart**: Persistent cart that works for both authenticated and guest users. Support quantity updates, removing items, and applying discount codes.

3. **Checkout**: Multi-step checkout flow: shipping address, shipping method, payment (Stripe), and order review. Support guest checkout and saved addresses for authenticated users.

4. **Order Management**: Customers can view order history, track shipment status, and request returns. Each order has a unique order number, status (pending, processing, shipped, delivered, cancelled), and timeline.

5. **Inventory Management**: Track stock levels per product variant. Auto-update inventory on purchase. Low stock alerts for admin.

6. **Admin Dashboard**: Admin panel for managing products (CRUD), viewing orders, managing customers, and viewing sales analytics (revenue, orders per day, top products).

7. **Customer Reviews**: Authenticated users can leave reviews with star ratings (1-5) and text. Reviews are moderated and displayed on product pages with aggregate ratings.

8. **Search & Filtering**: Full-text search across products. Filter by category, price range, rating, and availability. Sort by price, popularity, and newest.`,
}
