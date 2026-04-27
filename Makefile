.PHONY: help install dev build preview test test-unit test-watch test-e2e test-e2e-ui typecheck lint format format-check check clean

default: help

help: ## Display available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk -F ':.*?## ' '{printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# Installation & dev

install: ## Install all dependencies
	npm install
	npx playwright install chromium

dev: ## Start Next.js dev server (http://localhost:3000)
	npm run dev

build: ## Build for production
	npm run build

preview: build ## Preview the production build
	npm run start

# Code quality

format: ## Format code with Prettier
	npm run format

format-check: ## Check formatting (CI)
	npm run format:check

lint: ## Run ESLint
	npm run lint

typecheck: ## Run TypeScript type checking
	npm run typecheck

check: format-check lint typecheck test-unit ## Run all checks (CI gate)
	@echo "All checks passed!"

# Tests

test: test-unit test-e2e ## Run all tests

test-unit: ## Run unit and component tests (Vitest)
	npm run test:unit

test-watch: ## Run unit tests in watch mode
	npm run test:watch

test-e2e: ## Run e2e tests with Playwright
	npm run test:e2e

test-e2e-ui: ## Run e2e tests with Playwright UI
	npm run test:e2e:ui

# Maintenance

clean: ## Remove build artefacts
	rm -rf .next dist
