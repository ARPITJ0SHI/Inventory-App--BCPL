# Frontend Requirements & Dependencies

To ensure a modular, high-quality React Native application, we will use the following libraries and tools.

## Core Framework
- **React Native**: 0.81.5 (Latest Stable)
- **Expo**: ~54.0.30
- **Expo Router**: ~6.0.21 (File-based routing)

## UI & Animations
- **react-native-reanimated**: ~4.1.1 (High performance animations)
- **moti**: ^0.29.0 (Declarative animations, great for UI polish)
- **@expo/vector-icons**: ^15.0.3 (Icons)
- **expo-blur**: ~14.0.3 (Glassmorphism effects)
- **expo-linear-gradient**: ~14.0.2 (Gradient backgrounds)

## State & Data Management
- **axios**: ^1.7.9 (HTTP Client)
- **@tanstack/react-query**: ^5.62.0 (Optional but recommended for robust data fetching - *will start with simple useEffect/axios for simplicity unless requested*)
- **zustand** or **Context API**: (Simple state management)

## Forms & Validation
- **react-hook-form**: ^7.54.0 (Performance focused forms)
- **zod**: ^3.24.0 (Schema validation)

## Utilities
- **date-fns**: ^4.1.0 (Date formatting)
- **expo-secure-store**: ~14.0.1 (Secure storage for tokens)

## Dev Tools
- **typescript**: ~5.3.3
- **eslint**: ^8.57.0
- **prettier**: ^3.4.2

## Installation Command
```bash
npx expo install axios react-hook-form zod moti expo-secure-store expo-blur expo-linear-gradient date-fns
```
