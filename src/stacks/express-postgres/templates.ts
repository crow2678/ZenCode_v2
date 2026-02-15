/**
 * ZenCode V2 - Express + PostgreSQL Scaffold Templates
 *
 * Template files for scaffolding new Express + PostgreSQL projects
 */

/**
 * Get all scaffold templates as a Map
 */
export function getScaffoldTemplates(): Map<string, string> {
  const templates = new Map<string, string>()

  templates.set('package.json', PACKAGE_JSON)
  templates.set('tsconfig.json', TSCONFIG_JSON)
  templates.set('.env.example', ENV_EXAMPLE)
  templates.set('.gitignore', GITIGNORE)
  templates.set('src/app.ts', APP_TS)
  templates.set('src/server.ts', SERVER_TS)
  templates.set('src/config/index.ts', CONFIG_INDEX)
  templates.set('src/config/database.ts', CONFIG_DATABASE)
  templates.set('src/models/index.ts', MODELS_INDEX)
  templates.set('src/services/.gitkeep', '')
  templates.set('src/routes/index.ts', ROUTES_INDEX)
  templates.set('src/middleware/auth.ts', MIDDLEWARE_AUTH)
  templates.set('src/middleware/validate.ts', MIDDLEWARE_VALIDATE)
  templates.set('src/middleware/error-handler.ts', MIDDLEWARE_ERROR_HANDLER)
  templates.set('src/utils/async-handler.ts', UTILS_ASYNC_HANDLER)
  templates.set('src/types/index.ts', TYPES_INDEX)
  templates.set('tests/setup.ts', TESTS_SETUP)
  templates.set('.eslintrc.json', ESLINTRC)
  templates.set('.prettierrc', PRETTIERRC)

  return templates
}

/**
 * Get list of required files for a valid project
 */
export function getRequiredFiles(): string[] {
  return [
    'package.json',
    'tsconfig.json',
    'src/app.ts',
    'src/server.ts',
    'src/config/index.ts',
    'src/config/database.ts',
    'src/models/index.ts',
    'src/routes/index.ts',
    'src/middleware/error-handler.ts',
    'src/utils/async-handler.ts',
  ]
}

// =============================================================================
// Template Content
// =============================================================================

const PACKAGE_JSON = `{
  "name": "{{projectName}}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src/ --ext .ts",
    "test": "jest --config jest.config.ts"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.11.0",
    "pg-hstore": "^2.3.4",
    "sequelize": "^6.37.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.0",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^20.0.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0",
    "ts-jest": "^29.1.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}`

const TSCONFIG_JSON = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}`

const ENV_EXAMPLE = `# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/{{projectName}}

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d`

const GITIGNORE = `# Dependencies
node_modules/

# Build
dist/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*`

const APP_TS = `import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import routes from './routes'
import { errorHandler } from './middleware/error-handler'

const app = express()

// Security middleware
app.use(helmet())
app.use(cors())

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// API routes
app.use('/api', routes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Global error handler (must be last)
app.use(errorHandler)

export default app`

const SERVER_TS = `import app from './app'
import { config } from './config'
import { sequelize } from './config/database'

async function start() {
  try {
    // Test database connection
    await sequelize.authenticate()
    console.log('Database connection established')

    // Sync models in development
    if (config.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true })
      console.log('Models synchronized')
    }

    // Start server
    app.listen(config.PORT, () => {
      console.log(\`Server running on port \${config.PORT} (\${config.NODE_ENV})\`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

start()`

const CONFIG_INDEX = `import dotenv from 'dotenv'
dotenv.config()

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
}`

const CONFIG_DATABASE = `import { Sequelize } from 'sequelize'
import { config } from './index'

export const sequelize = new Sequelize(config.DATABASE_URL, {
  dialect: 'postgres',
  logging: config.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
  },
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
})`

const MODELS_INDEX = `/**
 * Model Registry
 *
 * Import and export all models here.
 * Define associations after all imports.
 */

// Import models here
// export { User } from './user'
// export { Post } from './post'

// Define associations here (after all imports)
// import { User } from './user'
// import { Post } from './post'
// User.hasMany(Post, { foreignKey: 'userId', as: 'posts' })
// Post.belongsTo(User, { foreignKey: 'userId', as: 'author' })`

const ROUTES_INDEX = `import { Router } from 'express'

const router = Router()

// Register routes here
// import userRoutes from './user'
// import authRoutes from './auth'
// router.use('/auth', authRoutes)
// router.use('/users', userRoutes)

// Default route
router.get('/', (req, res) => {
  res.json({ message: 'API is running', version: '0.1.0' })
})

export default router`

const MIDDLEWARE_AUTH = `import { Request, Response, NextFunction } from 'express'
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
    return res.status(401).json({ error: 'Authentication required' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}`

const MIDDLEWARE_VALIDATE = `import { Request, Response, NextFunction } from 'express'
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
}`

const MIDDLEWARE_ERROR_HANDLER = `import { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error & { status?: number },
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(\`[\${new Date().toISOString()}] Error:\`, err.message)

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message,
    })
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'Duplicate entry',
      message: err.message,
    })
  }

  // Custom error with status
  if (err.status) {
    return res.status(err.status).json({
      error: err.message,
    })
  }

  // Default to 500
  res.status(500).json({
    error: 'Internal server error',
  })
}`

const UTILS_ASYNC_HANDLER = `import { Request, Response, NextFunction } from 'express'

/**
 * Wraps an async route handler to catch errors and forward them to Express error handler.
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}`

const TYPES_INDEX = `/**
 * Shared TypeScript type definitions
 */

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface ApiError {
  error: string
  message?: string
  details?: unknown
}`

const TESTS_SETUP = `import { sequelize } from '../src/config/database'

beforeAll(async () => {
  // Use test database
  await sequelize.authenticate()
  await sequelize.sync({ force: true })
})

afterAll(async () => {
  await sequelize.close()
})`

const ESLINTRC = `{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "plugins": ["@typescript-eslint"],
  "env": {
    "node": true,
    "es2020": true,
    "jest": true
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn"
  }
}`

const PRETTIERRC = `{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100
}`
