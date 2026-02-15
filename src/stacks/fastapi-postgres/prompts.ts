/**
 * ZenCode V2 - FastAPI + PostgreSQL Prompt Templates
 *
 * AI prompts optimized for FastAPI with SQLAlchemy and PostgreSQL
 */

import type { PromptSection, PromptContext } from '../types'

/**
 * Get a specific prompt section for FastAPI + PostgreSQL stack
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

    default:
      return ''
  }
}

/**
 * Build complete system prompt for FastAPI + PostgreSQL
 */
export function buildSystemPrompt(context: PromptContext): string {
  const parts: string[] = [
    '# FastAPI + PostgreSQL Application',
    '',
    '## Tech Stack',
    '- **Framework**: FastAPI (Python 3.11+)',
    '- **Database**: PostgreSQL with SQLAlchemy ORM',
    '- **Validation**: Pydantic v2',
    '- **Migrations**: Alembic',
    '- **Authentication**: JWT with python-jose',
    '- **Testing**: pytest with httpx',
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
app/
├── __init__.py
├── main.py                 # FastAPI app entry point
├── config.py               # Settings and configuration
├── database.py             # Database connection
├── models/                 # SQLAlchemy models
│   ├── __init__.py
│   └── user.py
├── schemas/                # Pydantic schemas
│   ├── __init__.py
│   └── user.py
├── services/               # Business logic
│   ├── __init__.py
│   └── user.py
├── routers/                # API routes
│   ├── __init__.py
│   └── user.py
├── dependencies/           # Dependency injection
│   ├── __init__.py
│   └── auth.py
└── utils/                  # Utility functions
    └── __init__.py
alembic/                    # Database migrations
├── versions/
└── env.py
tests/                      # Test files
├── __init__.py
├── conftest.py
└── test_user.py
requirements.txt
.env.example
\`\`\``

const CODE_PATTERNS = `## Core Code Patterns

### FastAPI App Setup
\`\`\`python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import user, auth
from app.database import engine
from app.models import Base

app = FastAPI(title="API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(user.router, prefix="/api/users", tags=["users"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
\`\`\`

### Database Connection
\`\`\`python
# app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=True)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
\`\`\`

### Configuration
\`\`\`python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    class Config:
        env_file = ".env"

settings = Settings()
\`\`\``

const COMPONENT_PATTERNS = `## Frontend Patterns (if using templates)

For API-only backends, skip this section.
For full-stack with Jinja2:

\`\`\`python
from fastapi import Request
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="templates")

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
\`\`\``

const MODEL_PATTERNS = `## SQLAlchemy Model Patterns

### Model Definition
\`\`\`python
# app/models/user.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
\`\`\`

### Pydantic Schemas
\`\`\`python
# app/schemas/user.py
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2
\`\`\`

### Barrel Export
\`\`\`python
# app/models/__init__.py
from app.database import Base
from app.models.user import User

__all__ = ["Base", "User"]
\`\`\``

const SERVICE_PATTERNS = `## Service Layer Patterns

### Service Function
\`\`\`python
# app/services/user.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserCreate
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()

async def get_users(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[User]:
    result = await db.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()

async def create_user(db: AsyncSession, user: UserCreate) -> User:
    hashed_password = pwd_context.hash(user.password)
    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user
\`\`\``

const ROUTE_PATTERNS = `## FastAPI Router Patterns

### Router Definition
\`\`\`python
# app/routers/user.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.user import UserCreate, UserResponse
from app.services import user as user_service
from app.dependencies.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=list[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await user_service.get_users(db, skip=skip, limit=limit)

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    existing = await user_service.get_user_by_email(db, user.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    return await user_service.create_user(db, user)
\`\`\``

const AUTH_PATTERNS = `## Authentication Patterns (JWT)

### JWT Dependencies
\`\`\`python
# app/dependencies/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.services import user as user_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await user_service.get_user_by_email(db, email)
    if user is None:
        raise credentials_exception
    return user
\`\`\``

const VALIDATION_CHECKLIST = `## PRE-SUBMIT CHECKLIST (CRITICAL)

Before finalizing any file, verify:

1. **Imports resolve**
   - [ ] All imports use correct package names
   - [ ] Relative imports within app package
   - [ ] No circular imports

2. **Exports match usage**
   - [ ] \`__init__.py\` files export all public symbols
   - [ ] \`__all__\` list matches exports
   - [ ] Type hints use correct import paths

3. **SQLAlchemy correctness**
   - [ ] Models inherit from Base
   - [ ] Async session used with \`await\`
   - [ ] \`await db.commit()\` after mutations
   - [ ] \`await db.refresh(obj)\` to get generated fields

4. **Pydantic v2 patterns**
   - [ ] Use \`from_attributes = True\` (not \`orm_mode\`)
   - [ ] Use \`model_validate()\` (not \`from_orm()\`)
   - [ ] Use \`pydantic_settings\` for Settings

5. **FastAPI patterns**
   - [ ] Router included in main.py
   - [ ] Correct status codes for responses
   - [ ] Depends() for dependency injection
   - [ ] HTTPException for errors

6. **Async safety**
   - [ ] All DB operations use \`await\`
   - [ ] AsyncSession, not Session
   - [ ] \`async def\` for route handlers with DB`
