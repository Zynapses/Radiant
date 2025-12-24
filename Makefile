# RADIANT Makefile
# Common development commands

.PHONY: help install build dev test lint clean deploy docker-up docker-down migrate seed

# Default target
help:
	@echo "RADIANT Development Commands"
	@echo "============================"
	@echo ""
	@echo "Setup:"
	@echo "  make install      - Install all dependencies"
	@echo "  make setup        - Full development setup"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development servers"
	@echo "  make build        - Build all packages"
	@echo "  make test         - Run all tests"
	@echo "  make lint         - Lint all packages"
	@echo ""
	@echo "Database:"
	@echo "  make docker-up    - Start local services (Postgres, Redis)"
	@echo "  make docker-down  - Stop local services"
	@echo "  make migrate      - Run database migrations"
	@echo "  make seed         - Run seed data"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-dev   - Deploy to dev environment"
	@echo "  make deploy-prod  - Deploy to production"
	@echo "  make cdk-synth    - Synthesize CDK stacks"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make typecheck    - Run TypeScript checks"

# =============================================================================
# Setup
# =============================================================================

install:
	pnpm install

setup: install
	./scripts/setup-dev.sh

# =============================================================================
# Development
# =============================================================================

dev:
	pnpm dev

dev-dashboard:
	pnpm --filter @radiant/admin-dashboard dev

build:
	pnpm build

build-shared:
	pnpm --filter @radiant/shared build

build-infra:
	pnpm --filter @radiant/infrastructure build

build-dashboard:
	pnpm --filter @radiant/admin-dashboard build

build-lambda:
	pnpm --filter @radiant/infrastructure build:lambda

# =============================================================================
# Testing
# =============================================================================

test:
	pnpm test

test-unit:
	pnpm --filter @radiant/infrastructure test

test-e2e:
	pnpm --filter @radiant/admin-dashboard test:e2e

test-coverage:
	pnpm test -- --coverage

# =============================================================================
# Linting
# =============================================================================

lint:
	pnpm lint

lint-fix:
	pnpm lint --fix

typecheck:
	pnpm --filter @radiant/infrastructure tsc --noEmit
	pnpm --filter @radiant/admin-dashboard tsc --noEmit

# =============================================================================
# Database
# =============================================================================

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

migrate:
	./scripts/run-migrations.sh

seed:
	./scripts/run-migrations.sh --seed

migrate-fresh: docker-down docker-up
	@echo "Waiting for database to start..."
	@sleep 5
	./scripts/run-migrations.sh --seed

# =============================================================================
# Deployment
# =============================================================================

cdk-synth:
	pnpm --filter @radiant/infrastructure cdk synth

cdk-diff:
	pnpm --filter @radiant/infrastructure cdk diff

deploy-dev:
	ENVIRONMENT=dev pnpm --filter @radiant/infrastructure cdk deploy --all

deploy-staging:
	ENVIRONMENT=staging pnpm --filter @radiant/infrastructure cdk deploy --all --require-approval broadening

deploy-prod:
	ENVIRONMENT=production pnpm --filter @radiant/infrastructure cdk deploy --all --require-approval always

# =============================================================================
# Utilities
# =============================================================================

clean:
	rm -rf node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/dist
	rm -rf apps/*/.next
	rm -rf packages/infrastructure/cdk.out

clean-build:
	rm -rf packages/*/dist
	rm -rf apps/*/.next
	rm -rf packages/infrastructure/cdk.out

update-deps:
	pnpm update --interactive --latest

# =============================================================================
# Quick Commands
# =============================================================================

# Start everything for development
start: docker-up
	@echo "Waiting for services..."
	@sleep 3
	make dev

# Stop everything
stop: docker-down

# Fresh start with clean database
fresh: clean-build docker-down docker-up
	@sleep 5
	make migrate
	make seed
	make dev
