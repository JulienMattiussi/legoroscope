.PHONY: help install dev start stop build preview test test-unit test-watch test-e2e test-e2e-ui typecheck lint format format-check check clean

default: help

help: ## Display available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk -F ':.*?## ' '{printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# Installation & dev

install: ## Install all dependencies
	npm install
	npx playwright install chromium

dev: ## Start Next.js dev server in foreground (http://localhost:6677)
	npm run dev

start: ## Start Next.js dev server in background
	@if lsof -ti:6677 > /dev/null 2>&1; then echo "Port 6677 already in use — run 'make stop' first."; exit 1; fi
	npm run dev > .dev.log 2>&1 & echo $$! > .pid
	@echo "Dev server started → http://localhost:6677 (PID $$(cat .pid)) — logs in .dev.log"

stop: ## Stop the background dev server
	@if lsof -ti:6677 > /dev/null 2>&1; then lsof -ti:6677 | xargs kill && rm -f .pid && echo "Dev server stopped."; else rm -f .pid && echo "No server running."; fi

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
