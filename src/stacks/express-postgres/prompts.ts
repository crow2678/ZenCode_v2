/**
 * ZenCode V2 - Express + PostgreSQL Prompt Templates
 *
 * AI prompts optimized for Express.js with Sequelize and PostgreSQL
 */

import type { PromptSection, PromptContext } from '../types'

/**
 * Get a specific prompt section for Express + PostgreSQL stack
 */
export function getPromptSection(section: PromptSection): string {
  switch (section) {
    case 'project-structure':
      return PROJECT_STRUCTURE

    case 'code-patterns':
      return CODE_PATTERNS

    case 'component-patterns':
      return COMPONENT_PATTERNS

    case 'model-patterns':
      return MODEL_PATTERNS

    case 'service-patterns':
      return SERVICE_PATTERNS

    case 'route-patterns':
      return ROUTE_PATTERNS

    case 'auth-patterns':
      return AUTH_PATTERNS

    case 'validation-checklist':
      return VALIDATION_CHECKLIST

    case 'prd':
      return PRD_GENERATION

    case 'blueprint':
      return BLUEPRINT_GENERATION

    case 'work-orders':
      return WORK_ORDER_GENERATION

    case 'agent-execution':
      return AGENT_EXECUTION

    case 'scaffold':
      return SCAFFOLD_PATTERNS

    case 'missing_files':
      return MISSING_FILES_PATTERNS

    case 'validation_fixes':
      return VALIDATION_FIX_PATTERNS

    case 'wiring':
      return WIRING_PATTERNS

    default:
      return ''
  }
}

/**
 * Build complete system prompt for Express + PostgreSQL
 */
export function buildSystemPrompt(context: PromptContext): string {
  const parts: string[] = [
    '# Express + PostgreSQL Application',
    '',
    '## Tech Stack',
    '- **Framework**: Express.js (TypeScript)',
    '- **Database**: PostgreSQL with Sequelize ORM',
    '- **Validation**: Zod',
    '- **Authentication**: JWT with jsonwebtoken',
    '- **Testing**: Jest with supertest',
    '',
  ]

  if (context.projectName) {
    parts.push(`## Project: ${context.projectName}`, '')
  }

  if (context.authType && context.authType !== 'none') {
    parts.push('## Authentication', `- Using: ${context.authType}`, '')
    parts.push(AUTH_PATTERNS, '')
  }

  parts.push(PROJECT_STRUCTURE, '')
  parts.push(CODE_PATTERNS, '')
  parts.push(MODEL_PATTERNS, '')
  parts.push(SERVICE_PATTERNS, '')
  parts.push(ROUTE_PATTERNS, '')
  parts.push(VALIDATION_CHECKLIST)

  return parts.join('\n')
}

// =============================================================================
// Prompt Sections
// =============================================================================

const PROJECT_STRUCTURE = `## Project Structure

\`\`\`
src/
├── app.ts                  # Express app setup
├── server.ts               # Server entry point
├── config/
│   ├── index.ts            # Environment config
│   └── database.ts         # Sequelize connection
├── models/                 # Sequelize models
│   ├── index.ts            # Model registry + associations
│   └── user.ts
├── services/               # Business logic
│   └── user.ts
├── routes/                 # Express routers
│   ├── index.ts            # Route aggregator
│   └── user.ts
├── middleware/              # Custom middleware
│   ├── auth.ts             # JWT auth middleware
│   ├── validate.ts         # Zod validation middleware
│   └── error-handler.ts    # Global error handler
├── utils/                  # Utility functions
│   └── async-handler.ts    # Async error wrapper
└── types/                  # TypeScript type definitions
    └── index.ts
tests/                      # Test files
├── setup.ts
└── routes/
    └── user.test.ts
package.json
tsconfig.json
.env.example
\`\`\``

const CODE_PATTERNS = `## Core Code Patterns

### Express App Setup
\`\`\`typescript
// src/app.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { errorHandler } from './middleware/error-handler'
import routes from './routes'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api', routes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' })
})

// Global error handler (must be last)
app.use(errorHandler)

export default app
\`\`\`

### Server Entry Point
\`\`\`typescript
// src/server.ts
import app from './app'
import { config } from './config'
import { sequelize } from './config/database'

async function start() {
  try {
    await sequelize.authenticate()
    console.log('Database connected')

    // Sync models in development
    if (config.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true })
    }

    app.listen(config.PORT, () => {
      console.log(\`Server running on port \${config.PORT}\`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

start()
\`\`\`

### Configuration
\`\`\`typescript
// src/config/index.ts
import dotenv from 'dotenv'
dotenv.config()

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
}
\`\`\`

### Database Connection
\`\`\`typescript
// src/config/database.ts
import { Sequelize } from 'sequelize'
import { config } from './index'

export const sequelize = new Sequelize(config.DATABASE_URL, {
  dialect: 'postgres',
  logging: config.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
  },
})
\`\`\``

const COMPONENT_PATTERNS = `## Views/Templates (if using server-side rendering)

For API-only backends, skip this section.
For full-stack with EJS/Pug:

\`\`\`typescript
// src/app.ts
import path from 'path'

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))

// Route
app.get('/', (req, res) => {
  res.render('index', { title: 'Home' })
})
\`\`\``

const MODEL_PATTERNS = `## Sequelize Model Patterns

### Model Definition
\`\`\`typescript
// src/models/user.ts
import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../config/database'

interface UserAttributes {
  id: number
  email: string
  password: string
  name: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'isActive' | 'createdAt' | 'updatedAt'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number
  declare email: string
  declare password: string
  declare name: string
  declare isActive: boolean
  declare createdAt: Date
  declare updatedAt: Date
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'users',
    underscored: true,
  }
)
\`\`\`

### Model Registry and Associations
\`\`\`typescript
// src/models/index.ts
export { User } from './user'
export { Post } from './post'

// Define associations after all models are imported
import { User } from './user'
import { Post } from './post'

User.hasMany(Post, { foreignKey: 'userId', as: 'posts' })
Post.belongsTo(User, { foreignKey: 'userId', as: 'author' })
\`\`\``

const SERVICE_PATTERNS = `## Service Layer Patterns

### Service Function
\`\`\`typescript
// src/services/user.ts
import { User } from '../models'
import bcrypt from 'bcryptjs'

export async function createUser(data: {
  email: string
  password: string
  name: string
}) {
  const hashedPassword = await bcrypt.hash(data.password, 12)
  const user = await User.create({
    ...data,
    password: hashedPassword,
  })
  const { password, ...userWithoutPassword } = user.toJSON()
  return userWithoutPassword
}

export async function getUserById(id: number) {
  const user = await User.findByPk(id, {
    attributes: { exclude: ['password'] },
  })
  return user
}

export async function listUsers(page = 1, limit = 20) {
  const offset = (page - 1) * limit
  const { rows, count } = await User.findAndCountAll({
    attributes: { exclude: ['password'] },
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  })
  return { users: rows, total: count, page, totalPages: Math.ceil(count / limit) }
}
\`\`\``

const ROUTE_PATTERNS = `## Express Router Patterns

### Router Definition
\`\`\`typescript
// src/routes/user.ts
import { Router } from 'express'
import { z } from 'zod'
import * as userService from '../services/user'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { asyncHandler } from '../utils/async-handler'

const router = Router()

const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
  }),
})

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const result = await userService.listUsers(page, limit)
    res.json(result)
  })
)

router.post(
  '/',
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const user = await userService.createUser(req.body)
    res.status(201).json(user)
  })
)

export default router
\`\`\`

### Route Aggregator
\`\`\`typescript
// src/routes/index.ts
import { Router } from 'express'
import userRoutes from './user'
import authRoutes from './auth'

const router = Router()

router.use('/users', userRoutes)
router.use('/auth', authRoutes)

export default router
\`\`\`

### Async Handler Utility
\`\`\`typescript
// src/utils/async-handler.ts
import { Request, Response, NextFunction } from 'express'

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
\`\`\`

### Validation Middleware
\`\`\`typescript
// src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    })

    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten(),
      })
    }

    next()
  }
}
\`\`\``

const AUTH_PATTERNS = `## Authentication Patterns (JWT)

### Auth Middleware
\`\`\`typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'

interface JwtPayload {
  userId: number
  email: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
\`\`\`

### Token Generation
\`\`\`typescript
// src/services/auth.ts
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { User } from '../models'
import { config } from '../config'

export async function login(email: string, password: string) {
  const user = await User.findOne({ where: { email } })
  if (!user) throw new Error('Invalid credentials')

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) throw new Error('Invalid credentials')

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  )

  return { token, user: { id: user.id, email: user.email, name: user.name } }
}
\`\`\``

const VALIDATION_CHECKLIST = `## PRE-SUBMIT CHECKLIST (CRITICAL)

Before finalizing any file, verify:

1. **Imports resolve**
   - [ ] All \`@/\` paths map to \`src/\` (via tsconfig paths)
   - [ ] Relative imports use correct paths
   - [ ] No circular imports between models/services/routes

2. **Exports match usage**
   - [ ] Barrel files (index.ts) export ALL sibling modules
   - [ ] Named exports match what other files import
   - [ ] Default exports for routers, named exports for services

3. **Sequelize correctness**
   - [ ] Models extend Model<Attributes, CreationAttributes>
   - [ ] All model operations are awaited
   - [ ] Associations defined in models/index.ts after all imports
   - [ ] \`underscored: true\` for snake_case column names

4. **Express patterns**
   - [ ] Routes registered in routes/index.ts
   - [ ] Error handler middleware is LAST
   - [ ] asyncHandler wraps all async route handlers
   - [ ] Validation middleware before handler

5. **Security**
   - [ ] Passwords hashed with bcrypt (cost >= 12)
   - [ ] JWT secret from environment variable
   - [ ] helmet() and cors() middleware applied
   - [ ] Input validated with Zod before processing

6. **Error handling**
   - [ ] Global error handler catches all unhandled errors
   - [ ] Async errors forwarded via next() or asyncHandler
   - [ ] Meaningful HTTP status codes (400, 401, 403, 404, 500)`

// =============================================================================
// Generation Pipeline Prompts
// =============================================================================

const PRD_GENERATION = `## PRD Generation for Express + PostgreSQL

You are generating a Product Requirements Document for an Express.js API with PostgreSQL.

### Tech Stack Context
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL with Sequelize ORM
- **Validation**: Zod schemas
- **Auth**: JWT with jsonwebtoken + bcryptjs
- **Testing**: Jest + supertest

### PRD Structure
Generate a comprehensive PRD with these sections:
1. **Overview**: Brief description of the application
2. **Goals**: Key objectives the application should achieve
3. **User Personas**: Target users and their needs
4. **Functional Requirements**: Core features and behaviors
5. **Non-Functional Requirements**: Performance, security, scalability
6. **Data Models**: Entities, relationships, key fields (PostgreSQL tables)
7. **API Endpoints**: REST endpoints (GET, POST, PUT, DELETE)
8. **Authentication**: Auth requirements (JWT)
9. **Error Handling**: Error response format, status codes
10. **Success Metrics**: How to measure success

### Guidelines
- Be specific about data relationships (one-to-many, many-to-many via join tables)
- Include validation rules for user inputs
- Specify pagination, sorting, and filtering for list endpoints
- Define rate limiting and security requirements
- Consider database indexing needs`

const BLUEPRINT_GENERATION = `## Blueprint Generation for Express + PostgreSQL

You are generating a technical blueprint from a PRD for an Express.js API.

### Architecture Patterns
- **Models**: Sequelize models in src/models/
- **Services**: Business logic in src/services/
- **Routes**: Express routers in src/routes/
- **Middleware**: Auth, validation, error handling in src/middleware/

### Blueprint Structure

#### Models (Sequelize)
\`\`\`typescript
{
  name: "User",
  fields: [
    { name: "email", type: "STRING", required: true, unique: true },
    { name: "name", type: "STRING", required: true },
    { name: "password", type: "STRING", required: true }
  ],
  relationships: ["has many Posts", "has many Comments"]
}
\`\`\`

#### Services (Business Logic)
\`\`\`typescript
{
  name: "user",
  methods: [
    { name: "create", description: "Create new user", inputs: ["email", "name", "password"], outputs: "User" },
    { name: "list", description: "Paginated user list", inputs: ["page", "limit"], outputs: "{ users, total }" }
  ]
}
\`\`\`

#### Routes (REST API)
\`\`\`typescript
{
  name: "user",
  endpoints: [
    { method: "GET", path: "/api/users", description: "List all users" },
    { method: "POST", path: "/api/users", description: "Create user" },
    { method: "GET", path: "/api/users/:id", description: "Get user by ID" },
    { method: "PUT", path: "/api/users/:id", description: "Update user" },
    { method: "DELETE", path: "/api/users/:id", description: "Delete user" }
  ]
}
\`\`\`

### File Structure
\`\`\`
src/
├── app.ts
├── server.ts
├── config/
│   ├── index.ts
│   └── database.ts
├── models/
│   ├── index.ts
│   └── [entity].ts
├── services/
│   └── [entity].ts
├── routes/
│   ├── index.ts
│   └── [entity].ts
├── middleware/
│   ├── auth.ts
│   ├── validate.ts
│   └── error-handler.ts
└── utils/
    └── async-handler.ts
\`\`\``

const WORK_ORDER_GENERATION = `## Work Order Generation for Express + PostgreSQL

Generate work order METADATA only (title, description, file paths). DO NOT generate file content — code is generated later during execution.

### Work Order Phases (in order)
1. **models**: Sequelize models and type definitions
2. **services**: Business logic functions
3. **routes**: Express routers with validation
4. **middleware**: Auth, validation, error handling
5. **integration**: Wiring, barrel exports, app setup

### Work Order Structure (METADATA ONLY — no content field)
\`\`\`json
{
  "title": "Create User model",
  "description": "Sequelize model for User with fields: email (STRING, unique), name (STRING), password (STRING), isActive (BOOLEAN, default true). Include UserAttributes and UserCreationAttributes interfaces. Configure underscored column names.",
  "phase": "models",
  "files": [
    {
      "path": "src/models/user.ts",
      "action": "create",
      "description": "User model with Sequelize types, init(), and validations"
    }
  ]
}
\`\`\`

### Description Guidelines
- For models: list all fields with Sequelize DataTypes, constraints (unique, allowNull, defaultValue)
- For services: list all method names with brief input/output descriptions
- For routes: list all endpoints with HTTP methods and middleware chain
- For middleware: describe the middleware purpose and behavior
- For integration: describe barrel exports, app.use() registrations`

const AGENT_EXECUTION = `## Agent Code Generation for Express + PostgreSQL

You are generating production-ready code files for an Express.js application.

### TypeScript Requirements
- EVERY function parameter MUST have explicit types
- EVERY callback MUST have typed parameters
- Define interfaces for all data shapes
- Use strict null checks
- Use declare for Sequelize model attributes

### Import Patterns
\`\`\`typescript
// Models
import { User } from '../models'
// or
import { User } from '@/models'

// Services
import * as userService from '../services/user'
// or
import * as userService from '@/services/user'

// Config
import { config } from '../config'
import { sequelize } from '../config/database'

// Express
import { Router, Request, Response, NextFunction } from 'express'

// Middleware
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { asyncHandler } from '../utils/async-handler'
\`\`\`

### Sequelize Model Template
\`\`\`typescript
import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../config/database'

interface ExampleAttributes {
  id: number
  name: string
  createdAt: Date
  updatedAt: Date
}

interface ExampleCreationAttributes extends Optional<ExampleAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Example extends Model<ExampleAttributes, ExampleCreationAttributes> implements ExampleAttributes {
  declare id: number
  declare name: string
  declare createdAt: Date
  declare updatedAt: Date
}

Example.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'examples',
    underscored: true,
  }
)
\`\`\`

### Service Template
\`\`\`typescript
import { Example } from '../models'

export async function createExample(data: { name: string }) {
  const example = await Example.create(data)
  return example.toJSON()
}

export async function listExamples(page = 1, limit = 20) {
  const offset = (page - 1) * limit
  const { rows, count } = await Example.findAndCountAll({
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  })
  return { items: rows, total: count, page, totalPages: Math.ceil(count / limit) }
}
\`\`\`

### Router Template
\`\`\`typescript
import { Router } from 'express'
import { z } from 'zod'
import * as exampleService from '../services/example'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { asyncHandler } from '../utils/async-handler'

const router = Router()

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1
    const result = await exampleService.listExamples(page)
    res.json(result)
  })
)

router.post(
  '/',
  authenticate,
  validate(z.object({ body: z.object({ name: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const example = await exampleService.createExample(req.body)
    res.status(201).json(example)
  })
)

export default router
\`\`\`

### Error Handler Template
\`\`\`typescript
import { Request, Response, NextFunction } from 'express'

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err.stack)

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: 'Validation error', message: err.message })
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Duplicate entry', message: err.message })
  }

  res.status(500).json({ error: 'Internal server error' })
}
\`\`\``

// =============================================================================
// Assembly Pipeline Prompts
// =============================================================================

const SCAFFOLD_PATTERNS = `## Express + PostgreSQL Scaffold Files

Required configuration files:
- **package.json**: Include all dependencies (express, sequelize, pg, jsonwebtoken, bcryptjs, zod, cors, helmet, dotenv)
- **tsconfig.json**: With \`@/*\` path alias pointing to \`src/*\`, \`outDir: dist\`
- **.env.example**: DATABASE_URL, JWT_SECRET, PORT
- **Dockerfile**: Multi-stage build for production
- **docker-compose.yml**: App + PostgreSQL services

Framework detection:
- If existing files under src/routes/ → Express router pattern
- If existing files import from src/models/ → Sequelize models
- If app.ts exists → Express app entry point`

const MISSING_FILES_PATTERNS = `## Express + PostgreSQL Missing File Generation

CRITICAL FILES TO GENERATE:

1. **src/app.ts** (Express app)
\`\`\`typescript
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import routes from './routes'
import { errorHandler } from './middleware/error-handler'

const app = express()
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use('/api', routes)
app.get('/health', (req, res) => res.json({ status: 'ok' }))
app.use(errorHandler)

export default app
\`\`\`

2. **src/server.ts** (Entry point)
- Connects to database, syncs models, starts server

3. **src/config/database.ts** (Sequelize connection)
- Creates Sequelize instance from DATABASE_URL
- Configures dialect, logging, underscored option

4. **src/config/index.ts** (Environment config)
- Loads .env, exports config object

5. **src/middleware/error-handler.ts** (Global error handler)
- Catches Sequelize errors, validation errors, generic errors

6. **src/utils/async-handler.ts** (Async wrapper)
- Wraps async route handlers to forward errors to next()

7. **Barrel files (index.ts)** for:
- src/models/index.ts (exports all models + associations)
- src/routes/index.ts (registers all routers)`

const VALIDATION_FIX_PATTERNS = `## Validation Fix Patterns

### Export Mismatch Fixes
When file X imports { foo } from './bar' but bar.ts doesn't export foo:
1. Check if bar.ts uses export default — if so, change import to default import
2. Check sibling files for foo definition
3. Generate the missing function based on how it's called in X

### Barrel File Fixes
When models/index.ts is incomplete:
1. Look at all .ts files in models/ directory
2. Add: export { Model } from './model' for each
3. Add associations after all imports

### Sequelize Serialization Fixes
Error: cannot serialize Sequelize model
Fix: Use .toJSON() on model instances before returning

### Router Registration Fixes
Error: 404 on all routes
Fix: Ensure routes/index.ts imports and registers all route files
Fix: Ensure app.ts uses app.use('/api', routes)`

const WIRING_PATTERNS = `## Wiring Generation Patterns

### Barrel Files (index.ts)
For models directory:
\`\`\`typescript
// src/models/index.ts
export { User } from './user'
export { Post } from './post'
export { Comment } from './comment'

// Associations (after all imports)
import { User } from './user'
import { Post } from './post'
import { Comment } from './comment'

User.hasMany(Post, { foreignKey: 'userId', as: 'posts' })
Post.belongsTo(User, { foreignKey: 'userId', as: 'author' })
Post.hasMany(Comment, { foreignKey: 'postId', as: 'comments' })
Comment.belongsTo(Post, { foreignKey: 'postId', as: 'post' })
Comment.belongsTo(User, { foreignKey: 'userId', as: 'author' })
\`\`\`

### Route Registration
\`\`\`typescript
// src/routes/index.ts
import { Router } from 'express'
import userRoutes from './user'
import postRoutes from './post'
import authRoutes from './auth'

const router = Router()

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/posts', postRoutes)

export default router
\`\`\`

### File Naming Preference
- Services/Routes/Models: SINGULAR (user.ts, not users.ts)
- Middleware: descriptive kebab-case (error-handler.ts, async-handler.ts)
- If both exist, only export from singular`
