# Development Guide

This guide covers development workflows, testing procedures, and deployment processes for Ambitionly.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun (recommended)
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (macOS) or Android Emulator
- Git

### Setup
```bash
# Clone and install
git clone <repository-url>
cd ambitionly-ai-goal-roadmap-app
bun install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
bun start
```

## 🛠️ Development Workflow

### Available Scripts

```bash
# Development
bun start                    # Start with tunnel (mobile testing)
bun run start-web           # Web development
bun run start-web-dev       # Web with debug logs

# Code Quality
bun run lint                # Run ESLint
bun run type-check          # TypeScript type checking

# Testing (when implemented)
bun test                    # Unit tests
bun test:e2e               # End-to-end tests
bun test:coverage          # Test coverage

# Building
npx expo export --platform web    # Web build
npx eas build --platform ios      # iOS build
npx eas build --platform android  # Android build

# Deployment
npx eas submit --platform ios     # Submit to App Store
npx eas submit --platform android # Submit to Play Store
```

### Code Style Guidelines

#### TypeScript
- Use strict type checking
- Explicit type annotations for useState: `useState<Type[]>([])`
- Proper null/undefined handling with optional chaining
- Complete object creation with all required properties

```typescript
// ✅ Good
const [tasks, setTasks] = useState<Task[]>([]);
const user = data?.user?.profile;

// ❌ Bad
const [tasks, setTasks] = useState([]);
const user = data.user.profile;
```

#### React Native
- Use StyleSheet for styling
- Proper testId for testing
- Error boundaries for error handling
- Platform-specific code when needed

```typescript
// ✅ Good
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
});

// Platform-specific code
if (Platform.OS !== 'web') {
  await Haptics.selectionAsync();
}
```

#### State Management
- Use React Query for server state
- Use useState for local state
- Use @nkzw/create-context-hook for shared state
- Avoid props drilling

```typescript
// ✅ Context hook pattern
export const [TodoContext, useTodos] = createContextHook(() => {
  const [todos, setTodos] = useState<Todo[]>([]);
  
  const todosQuery = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos
  });

  return { todos, addTodo, isLoading: todosQuery.isLoading };
});
```

## 🧪 Testing Strategy

### Manual Testing Checklist

#### Core Functionality
- [ ] Goal creation and validation
- [ ] AI roadmap generation with fallback
- [ ] Task progression and unlocking
- [ ] Timer functionality with notifications
- [ ] Offline data persistence
- [ ] Error handling and recovery

#### Cross-Platform Testing
- [ ] iOS (physical device + simulator)
- [ ] Android (physical device + emulator)
- [ ] Web (Chrome, Safari, Firefox)
- [ ] Different screen sizes and orientations

#### Performance Testing
- [ ] App startup time < 2 seconds
- [ ] Smooth animations (60fps)
- [ ] Memory usage monitoring
- [ ] Battery usage optimization

### Automated Testing (Future)

```bash
# Unit tests for business logic
describe('Task Management', () => {
  it('should unlock next phase when all tasks completed', () => {
    // Test implementation
  });
});

# Integration tests for API
describe('Roadmap API', () => {
  it('should generate roadmap with valid input', async () => {
    // Test implementation
  });
});

# E2E tests for user flows
describe('Onboarding Flow', () => {
  it('should complete goal creation flow', async () => {
    // Test implementation
  });
});
```

## 🔍 Debugging

### Debug Settings
Access via `/dev-settings` with credentials:
- Username: `ag3nt`
- Password: `fuckyouu`

### Available Debug Tools
- Current build/version info
- Auth state inspection
- API error logs
- Offline mode simulation
- Performance monitoring
- Analytics event tracking

### Logging
```typescript
import { debugLog } from '@/lib/debug';

// Tagged logging (silenced in production)
debugLog('user-action', 'Goal created', { goalId: '123' });
debugLog('api-error', 'Failed to generate roadmap', error);
debugLog('performance', 'Screen render time', { duration: 150 });
```

### Error Monitoring
```typescript
import { reportError } from '@/lib/error-reporting';

try {
  // Risky operation
} catch (error) {
  reportError(error, {
    context: 'roadmap-generation',
    userId: user?.id,
    additionalData: { goalId }
  });
}
```

## 📊 Analytics Implementation

### Event Tracking
```typescript
import { trackEvent } from '@/lib/analytics';

// Track user actions
trackEvent('goal_created', {
  goalType: 'career',
  timeline: '3 months',
  userId: user.id
});

trackEvent('task_completed', {
  taskId: task.id,
  phaseId: phase.id,
  completionTime: timer.duration
});
```

### Available Events
- `app_opened` - App launch
- `goal_created` - New goal creation
- `roadmap_generated` - AI roadmap generation
- `task_completed` - Task completion
- `timer_started` - Task timer started
- `timer_completed` - Task timer finished
- `phase_unlocked` - New phase unlocked
- `error_occurred` - Error events

## 🚀 Deployment Process

### Environment Configuration

#### Development
```env
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:3000
DEBUG=expo*
```

#### Staging
```env
EXPO_PUBLIC_RORK_API_BASE_URL=https://staging-api.ambitionly.app
EXPO_PUBLIC_ANALYTICS_API_KEY=ak_test_1234567890abcdef
```

#### Production
```env
EXPO_PUBLIC_RORK_API_BASE_URL=https://api.ambitionly.app
EXPO_PUBLIC_ANALYTICS_API_KEY=ak_live_1234567890abcdef
EXPO_PUBLIC_SENTRY_DSN=https://1234567890abcdef@sentry.io/123456
```

### Build Process

#### iOS
```bash
# Update version in app.json
# \"ios\": { \"buildNumber\": \"2\" }

# Build
npx eas build --platform ios --profile production

# Test build on device
# Download from EAS and install via Xcode or TestFlight

# Submit to App Store
npx eas submit --platform ios
```

#### Android
```bash
# Update version in app.json
# \"android\": { \"versionCode\": 2 }

# Build
npx eas build --platform android --profile production

# Test build on device
# Download APK from EAS and install

# Submit to Play Store
npx eas submit --platform android
```

#### Web
```bash
# Build static files
npx expo export --platform web

# Deploy to hosting service
# Upload dist/ folder to your web host
```

### Release Checklist
See [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for comprehensive pre-release validation.

## 🔧 Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules .expo
bun install
npx expo prebuild --clean
```

#### Metro bundler issues
```bash
# Reset Metro cache
npx expo start --clear
```

#### TypeScript errors
```bash
# Check types without emitting
npx tsc --noEmit

# Common fixes
# - Add explicit type annotations
# - Check import paths
# - Verify all required properties
```

#### Platform-specific issues
```typescript
// Web compatibility
if (Platform.OS !== 'web') {
  // Native-only code
  await Haptics.selectionAsync();
}

// iOS/Android differences
const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.select({
      ios: 20,
      android: 25,
      web: 0,
    }),
  },
});
```

### Performance Issues
- Use React.memo() for expensive components
- Implement useMemo() and useCallback() with proper dependencies
- Monitor memory usage in debug tools
- Profile animations with Flipper

### Network Issues
- Check API endpoints in debug settings
- Verify environment variables
- Test offline functionality
- Monitor request/response in network tab

## 📚 Additional Resources

### Documentation
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Query Documentation](https://tanstack.com/query/latest)

### Tools
- [Expo Dev Tools](https://docs.expo.dev/debugging/tools/)
- [React Native Debugger](https://github.com/jhen0409/react-native-debugger)
- [Flipper](https://fbflipper.com/)

### Community
- [Expo Discord](https://discord.gg/expo)
- [React Native Community](https://reactnative.dev/community/overview)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/expo)

---

**Happy coding! 🚀**