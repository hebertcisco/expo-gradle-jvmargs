import { createRunOncePlugin, withGradleProperties } from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';

import pkg from '../../package.json';

type GradlePropertyItem =
  | { type: 'comment'; value: string }
  | { type: 'empty' }
  | { type: 'property'; key: string; value: string };

/** Gradle's documented build-VM defaults beyond heap/metaspace (config_gradle / build_environment). */
const GRADLE_SAFETY_ARGS = [
  '-XX:+HeapDumpOnOutOfMemoryError',
  '-Dfile.encoding=UTF-8',
] as const;

const JVM_ARGS_KEY = 'org.gradle.jvmargs';
const KOTLIN_DAEMON_JVMARGS_KEY = 'kotlin.daemon.jvmargs';

const MEMORY_SIZE_RE = /^\d+[kKmMgGtT]?$/;
const XMX_RE = /^-Xmx\S+$/i;
const MAX_METASPACE_RE = /^-XX:MaxMetaspaceSize=\S+$/i;
const FILE_ENCODING_RE = /^-Dfile\.encoding=/i;
const HEAP_DUMP_OOM_RE = /^-XX:\+HeapDumpOnOutOfMemoryError$/i;

export interface WithGradleJvmArgsProps {
  /** Value for `-Xmx`, e.g. `"2048m"` or `"2g"`. Default: `"2048m"`. */
  xmx?: string;
  /** Value for `-XX:MaxMetaspaceSize`, e.g. `"512m"`. Default: `"512m"`. */
  maxMetaspace?: string;
  /**
   * Merge with existing `org.gradle.jvmargs` tokens rather than overwriting all values.
   * When `true`, the plugin removes any existing `-Xmx*` and `-XX:MaxMetaspaceSize=*` tokens
   * then adds the configured values, leaving any other tokens intact.
   * @default true
   */
  merge?: boolean;
  /**
   * When `true`, ensure Gradle's recommended safety flags are present:
   * `-XX:+HeapDumpOnOutOfMemoryError` and `-Dfile.encoding=UTF-8`.
   * Setting `org.gradle.jvmargs` replaces Gradle defaults entirely, so these are re-applied.
   * @default true
   */
  includeGradleDefaults?: boolean;
  /** Additional JVM args to append to `org.gradle.jvmargs`, e.g. `["-Dkotlin.daemon.useFallbackStrategy=true"]`. */
  extraArgs?: string[];
  /**
   * Optional value for `kotlin.daemon.jvmargs` (separate Kotlin compiler daemon process).
   * When set, the property is created or replaced. When omitted, the property is left untouched.
   * Example: `"-Xmx1500m"`.
   */
  kotlinDaemonJvmArgs?: string;
}

function toTokens(value: unknown): string[] {
  if (!value || typeof value !== 'string') return [];
  // Split on whitespace while respecting simple quoted tokens from Gradle defaults.
  const matches = value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return matches
    .map((t) => {
      const trimmed = t.trim();
      if (
        trimmed.length >= 2 &&
        ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'")))
      ) {
        return trimmed.slice(1, -1).trim();
      }
      return trimmed;
    })
    .filter(Boolean);
}

function uniqueTokens(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of list) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function sanitizeExtraArgs(extraArgs: unknown): string[] {
  if (!Array.isArray(extraArgs)) return [];
  return (extraArgs as unknown[]).map((s) => String(s).trim()).filter(Boolean);
}

function normalizeMemorySize(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (!MEMORY_SIZE_RE.test(trimmed)) {
    throw new Error(
      `Invalid memory size "${trimmed}". Expected JVM size notation such as "2048m" or "2g".`,
    );
  }
  // Canonicalize unit suffix (Gradle/JVM accept either case; keep values stable across machines).
  return trimmed.replace(/([kKmMgGtT])$/, (unit) => unit.toLowerCase());
}

function upsertProperty(
  items: GradlePropertyItem[],
  key: string,
  value: string,
): GradlePropertyItem[] {
  const next: GradlePropertyItem[] = Array.isArray(items) ? [...items] : [];
  const idx = next.findIndex((p) => p.type === 'property' && p.key === key);
  if (idx >= 0) {
    next[idx] = { type: 'property', key, value };
    return next;
  }
  next.push({ type: 'property', key, value });
  return next;
}

function isManagedMemoryToken(token: string): boolean {
  return XMX_RE.test(token) || MAX_METASPACE_RE.test(token);
}

function isGradleSafetyConflict(token: string): boolean {
  return FILE_ENCODING_RE.test(token) || HEAP_DUMP_OOM_RE.test(token);
}

function buildJvmArgsValue(props: WithGradleJvmArgsProps, existingValue: string): string {
  const desiredXmx = normalizeMemorySize(props.xmx, '2048m');
  const desiredMetaspace = normalizeMemorySize(props.maxMetaspace, '512m');
  const merge = props.merge !== false;
  const includeGradleDefaults = props.includeGradleDefaults !== false;

  // Plugin-managed memory options always win over extras / existing tokens.
  let extraArgs = sanitizeExtraArgs(props.extraArgs).filter((t) => !isManagedMemoryToken(t));
  if (includeGradleDefaults) {
    extraArgs = extraArgs.filter((t) => !isGradleSafetyConflict(t));
  }

  const existingTokens = toTokens(existingValue);
  let unmanagedTokens = existingTokens.filter((t) => !isManagedMemoryToken(t));

  // Setting org.gradle.jvmargs replaces daemon defaults; when we restore safety flags,
  // drop conflicting encoding / HeapDump tokens so the final line stays unambiguous.
  if (includeGradleDefaults) {
    unmanagedTokens = unmanagedTokens.filter((t) => !isGradleSafetyConflict(t));
  }

  const nextTokens: string[] = [
    `-Xmx${desiredXmx}`,
    `-XX:MaxMetaspaceSize=${desiredMetaspace}`,
    ...(merge ? unmanagedTokens : []),
    ...(includeGradleDefaults ? [...GRADLE_SAFETY_ARGS] : []),
    ...extraArgs,
  ];

  return uniqueTokens(nextTokens).join(' ');
}

/**
 * Update or insert the `org.gradle.jvmargs` property in `android/gradle.properties`.
 *
 * - Removes any existing `-Xmx` and `-XX:MaxMetaspaceSize` tokens
 * - Adds the configured values
 * - When `merge` is true (default), preserves other existing tokens
 * - Optionally restores Gradle safety defaults that are dropped when the property is set
 * - Appends any `extraArgs` last, then deduplicates all tokens
 * - Optionally sets `kotlin.daemon.jvmargs` for the separate Kotlin compiler daemon
 */
const withGradleJvmArgsImpl: ConfigPlugin<WithGradleJvmArgsProps> = (config, props = {}) => {
  return withGradleProperties(config, (cfg) => {
    const gradleProps: GradlePropertyItem[] = Array.isArray(cfg.modResults)
      ? (cfg.modResults as GradlePropertyItem[])
      : [];

    const existingIdx = gradleProps.findIndex(
      (p) => p.type === 'property' && p.key === JVM_ARGS_KEY,
    );
    const existingProp = existingIdx >= 0 ? gradleProps[existingIdx] : null;
    const existingValue =
      existingProp?.type === 'property' ? String(existingProp.value ?? '') : '';

    let nextProps = upsertProperty(
      gradleProps,
      JVM_ARGS_KEY,
      buildJvmArgsValue(props, existingValue),
    );

    if (typeof props.kotlinDaemonJvmArgs === 'string') {
      const kotlinValue = props.kotlinDaemonJvmArgs.trim();
      if (kotlinValue) {
        nextProps = upsertProperty(nextProps, KOTLIN_DAEMON_JVMARGS_KEY, kotlinValue);
      }
    }

    cfg.modResults = nextProps as typeof cfg.modResults;
    return cfg;
  });
};

const withGradleJvmArgs: ConfigPlugin<WithGradleJvmArgsProps> = createRunOncePlugin(
  withGradleJvmArgsImpl,
  pkg.name,
  pkg.version,
);

export default withGradleJvmArgs;
