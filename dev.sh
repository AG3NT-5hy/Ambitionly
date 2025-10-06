#!/bin/bash

# Ambitionly Development Helper Script
# Usage: ./dev.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if bun is available, fallback to npm
if command -v bun &> /dev/null; then
    PKG_MANAGER="bun"
    RUN_CMD="bun run"
else
    PKG_MANAGER="npm"
    RUN_CMD="npm run"
fi

# Commands
case "$1" in
    "setup")
        log_info "Setting up Ambitionly development environment..."
        
        # Check prerequisites
        if ! command -v node &> /dev/null; then
            log_error "Node.js is not installed. Please install Node.js 18+ or Bun."
            exit 1
        fi
        
        # Install dependencies
        log_info "Installing dependencies with $PKG_MANAGER..."
        $PKG_MANAGER install
        
        # Setup environment file
        if [ ! -f ".env.local" ]; then
            log_info "Creating .env.local from template..."
            cp .env.example .env.local
            log_warning "Please edit .env.local with your configuration"
        else
            log_info ".env.local already exists"
        fi
        
        log_success "Setup complete! Run './dev.sh start' to begin development"
        ;;
        
    "start")
        log_info "Starting development server..."
        $PKG_MANAGER start
        ;;
        
    "web")
        log_info "Starting web development server..."
        $RUN_CMD start-web
        ;;
        
    "check")
        log_info "Running code quality checks..."
        
        # Type checking
        log_info "Checking TypeScript types..."
        npx tsc --noEmit
        
        # Linting
        log_info "Running ESLint..."
        $RUN_CMD lint
        
        log_success "All checks passed!"
        ;;
        
    "fix")
        log_info "Fixing code issues..."
        $RUN_CMD lint --fix 2>/dev/null || log_warning "Some lint issues may need manual fixing"
        log_success "Auto-fixable issues resolved!"
        ;;
        
    "clean")
        log_info "Cleaning project..."
        rm -rf node_modules .expo
        $PKG_MANAGER install
        log_success "Project cleaned and dependencies reinstalled!"
        ;;
        
    "build")
        case "$2" in
            "ios")
                log_info "Building for iOS..."
                npx eas build --platform ios --profile production
                ;;
            "android")
                log_info "Building for Android..."
                npx eas build --platform android --profile production
                ;;
            "web")
                log_info "Building for Web..."
                npx expo export --platform web
                ;;
            *)
                log_error "Please specify platform: ios, android, or web"
                echo "Usage: ./dev.sh build [ios|android|web]"
                exit 1
                ;;
        esac
        ;;
        
    "test")
        log_info "Running tests..."
        if [ -f "package.json" ] && grep -q "\"test\":" package.json; then
            $RUN_CMD test
        else
            log_warning "Tests not yet implemented"
        fi
        ;;
        
    "release")
        log_info "Preparing for release..."
        
        # Run checks
        log_info "Running pre-release checks..."
        ./dev.sh check
        
        # Show checklist
        log_info "Please review the release checklist:"
        echo "📋 RELEASE_CHECKLIST.md"
        echo "📚 Ensure all documentation is up to date"
        echo "🧪 Run manual testing on all platforms"
        echo "🔧 Update version numbers in app.json"
        
        log_success "Pre-release checks complete!"
        ;;
        
    "help"|"")
        echo "🚀 Ambitionly Development Helper"
        echo ""
        echo "Available commands:"
        echo "  setup     - Set up development environment"
        echo "  start     - Start development server with tunnel"
        echo "  web       - Start web development server"
        echo "  check     - Run type checking and linting"
        echo "  fix       - Auto-fix linting issues"
        echo "  clean     - Clean and reinstall dependencies"
        echo "  build     - Build for platform (ios|android|web)"
        echo "  test      - Run tests"
        echo "  release   - Prepare for release"
        echo "  help      - Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./dev.sh setup"
        echo "  ./dev.sh start"
        echo "  ./dev.sh build ios"
        echo "  ./dev.sh check"
        ;;
        
    *)
        log_error "Unknown command: $1"
        echo "Run './dev.sh help' for available commands"
        exit 1
        ;;
esac