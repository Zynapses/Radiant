# RADIANT Gateway - Development Commands

.PHONY: all build run test clean docker-up docker-down deps lint

# Default target
all: build

# Install Go dependencies
deps:
	go mod download
	go mod tidy

# Build the gateway binary
build: deps
	CGO_ENABLED=0 go build -ldflags="-w -s" -o bin/gateway ./cmd/gateway

# Run the gateway locally (requires NATS to be running)
run: build
	GATEWAY_DEV=true ./bin/gateway

# Run with live reload (requires air: go install github.com/cosmtrek/air@latest)
dev:
	air

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-cover:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Lint the code (requires golangci-lint)
lint:
	golangci-lint run

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f coverage.out coverage.html

# Docker commands (run from project root)
docker-up:
	docker compose -f ../../infrastructure/docker/gateway/docker-compose.yml up -d

docker-down:
	docker compose -f ../../infrastructure/docker/gateway/docker-compose.yml down -v

docker-logs:
	docker compose -f ../../infrastructure/docker/gateway/docker-compose.yml logs -f

# Build Docker image
docker-build:
	docker build -t radiant-gateway:dev .

# Quick start: start all services and run gateway
start: docker-up
	@echo "Waiting for NATS to be ready..."
	@sleep 5
	$(MAKE) run

# Stop everything
stop: docker-down
	@pkill -f "bin/gateway" || true

# Test WebSocket connection (requires wscat: npm install -g wscat)
test-ws:
	@echo "Testing WebSocket connection..."
	@echo '{"jsonrpc":"2.0","method":"initialize","id":1}' | wscat -c ws://localhost:8443/ws

# Show help
help:
	@echo "RADIANT Gateway - Available Commands"
	@echo ""
	@echo "  make deps        - Install Go dependencies"
	@echo "  make build       - Build the gateway binary"
	@echo "  make run         - Run the gateway locally"
	@echo "  make dev         - Run with live reload (requires air)"
	@echo "  make test        - Run tests"
	@echo "  make lint        - Lint the code"
	@echo "  make clean       - Clean build artifacts"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make docker-up   - Start NATS and supporting services"
	@echo "  make docker-down - Stop and remove containers"
	@echo "  make docker-logs - Follow container logs"
	@echo ""
	@echo "Quick Start:"
	@echo "  make start       - Start everything and run gateway"
	@echo "  make stop        - Stop everything"
	@echo "  make test-ws     - Test WebSocket connection"
