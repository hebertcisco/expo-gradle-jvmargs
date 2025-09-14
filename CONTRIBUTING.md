# Contributing to expo-gradle-jvmargs

Thanks for taking the time to contribute! This document outlines a lightweight process to help changes land smoothly.

## Getting Started

- Node 18+ recommended.
- Fork and clone the repo, then install dependencies:
  ```bash
  npm install
  ```

## Development Workflow

This package exposes an Expo config plugin via `app.plugin.js` that re-exports from `plugin/build`.
The plugin uses `createRunOncePlugin` to avoid duplicate execution.

- Make your changes in `plugin/build/withGradleJvmArgs.js` (or its source if you add TS).
- Test by linking or using a local path in an Expo app's config and running:
  ```bash
  npx expo prebuild -p android
  ```
  Then verify `android/gradle.properties` has the expected `org.gradle.jvmargs` line.

### Debugging

- Enable verbose logs with `EXPO_DEBUG=1`.
- See Expo config plugin debugging guide: https://docs.expo.dev/config-plugins/development-and-debugging/

## Code Style

- Keep the implementation minimal and focused.
- Avoid adding extra dependencies.
- Prefer clear naming and small, well-scoped functions.

## Commit Messages

- Use concise, meaningful messages.
- Reference issues when applicable (e.g., `fix: handle missing gradle.properties (#12)`).

## Pull Requests

- Describe the motivation, what changed, and how you tested.
- Update documentation when behavior or options change.
- Keep PRs small and targeted.

## Releases

- Maintainers handle publishing. Changes merged to `main` will be released as needed.

## Questions & Support

- Open a GitHub Issue for bugs, questions, or feature requests.

Thanks again for your contribution!
