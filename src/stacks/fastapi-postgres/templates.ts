/**
 * ZenCode V2 - FastAPI + PostgreSQL Scaffold Templates
 *
 * Template files for scaffolding new FastAPI + PostgreSQL projects
 */

/**
 * Get all scaffold templates as a Map
 */
export function getScaffoldTemplates(): Map<string, string> {
  const templates = new Map<string, string>()

  templates.set('requirements.txt', REQUIREMENTS_TXT)
  templates.set('.env.example', ENV_EXAMPLE)
  templates.set('.gitignore', GITIGNORE)
  templates.set('app/__init__.py', APP_INIT)
  templates.set('app/main.py', MAIN_PY)
  templates.set('app/config.py', CONFIG_PY)
  templates.set('app/database.py', DATABASE_PY)
  templates.set('app/models/__init__.py', MODELS_INIT)
  templates.set('app/schemas/__init__.py', SCHEMAS_INIT)
  templates.set('app/services/__init__.py', SERVICES_INIT)
  templates.set('app/routers/__init__.py', ROUTERS_INIT)
  templates.set('app/dependencies/__init__.py', DEPS_INIT)
  templates.set('tests/__init__.py', TESTS_INIT)
  templates.set('tests/conftest.py', CONFTEST_PY)

  return templates
}

/**
 * Get list of required files for a valid project
 */
export function getRequiredFiles(): string[] {
  return [
    'requirements.txt',
    'app/__init__.py',
    'app/main.py',
    'app/config.py',
    'app/database.py',
    'app/models/__init__.py',
    'app/schemas/__init__.py',
    'app/services/__init__.py',
    'app/routers/__init__.py',
  ]
}

// =============================================================================
// Template Content
// =============================================================================

const REQUIREMENTS_TXT = `fastapi>=0.109.0
uvicorn[standard]>=0.27.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.6
alembic>=1.13.0
httpx>=0.26.0
pytest>=7.4.0
pytest-asyncio>=0.23.0`

const ENV_EXAMPLE = `# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/{{projectName}}

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# App
DEBUG=true`

const GITIGNORE = `# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual environments
venv/
.venv/
ENV/
env/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Environment
.env
.env.local

# Testing
.coverage
htmlcov/
.pytest_cache/

# Alembic
alembic/versions/*.pyc`

const APP_INIT = `"""
{{projectName}} - FastAPI Application
"""

__version__ = "0.1.0"`

const MAIN_PY = `"""
FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models import Base

app = FastAPI(
    title="{{projectName}}",
    version="0.1.0",
    description="Built with ZenCode",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers here
# from app.routers import user
# app.include_router(user.router, prefix="/api/users", tags=["users"])


@app.on_event("startup")
async def startup():
    """Create database tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}`

const CONFIG_PY = `"""
Application Configuration
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()`

const DATABASE_PY = `"""
Database Connection and Session Management
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
)

# Async session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()


async def get_db():
    """Dependency that provides a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()`

const MODELS_INIT = `"""
SQLAlchemy Models
"""

from app.database import Base

# Import models here to register with Base
# from app.models.user import User

__all__ = ["Base"]`

const SCHEMAS_INIT = `"""
Pydantic Schemas
"""

# Import schemas here
# from app.schemas.user import UserCreate, UserResponse

__all__ = []`

const SERVICES_INIT = `"""
Business Logic Services
"""

# Import services here
# from app.services import user

__all__ = []`

const ROUTERS_INIT = `"""
API Routers
"""

# Import routers here
# from app.routers import user

__all__ = []`

const DEPS_INIT = `"""
Dependency Injection
"""

# Import dependencies here
# from app.dependencies.auth import get_current_user

__all__ = []`

const TESTS_INIT = `"""
Test Suite
"""`

const CONFTEST_PY = `"""
Pytest Configuration and Fixtures
"""

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db

# Test database URL (use SQLite for testing)
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(TEST_DATABASE_URL, echo=True)
TestingSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with database override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()`
