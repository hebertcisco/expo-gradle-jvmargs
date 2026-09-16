# Changelog

## 1.2.0

- Migrate the package to TypeScript end-to-end (plugin source, tests, Jest/ESLint configs).
- Restore Gradle daemon safety defaults by default (`-XX:+HeapDumpOnOutOfMemoryError`, `-Dfile.encoding=UTF-8`) via `includeGradleDefaults`.
- Add optional `kotlinDaemonJvmArgs` to set `kotlin.daemon.jvmargs`.
- Validate and canonicalize memory sizes (`2048M` → `2048m`); reject invalid values.
- Parse quoted JVM arg tokens; avoid conflicting encoding / heap-dump / memory flags from merge or `extraArgs`.
- Expand unit tests; target `@expo/config-plugins` ^57 for development.
- CI runs `yarn lint` in addition to typecheck/build/test.

## 1.1.2

- Previous stable release with mergeable `-Xmx` / `-XX:MaxMetaspaceSize` management.
