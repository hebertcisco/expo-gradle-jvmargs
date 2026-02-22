import { createRunOncePlugin, withGradleProperties } from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg: { name: string; version: string } = require('../../package.json');

export interface WithGradleJvmArgsProps {
  /** Value for `-Xmx`, e.g. `"2048m"` */
  xmx?: string;
  /** Value for `-XX:MaxMetaspaceSize`, e.g. `"512m"` */
  maxMetaspace?: string;
  /**
   * Merge with existing `org.gradle.jvmargs` tokens rather than overwriting all values.
   * When `true`, the plugin removes any existing `-Xmx*` and `-XX:MaxMetaspaceSize=*` tokens
   * then adds the configured values, leaving any other tokens intact.
   * @default true
   */
  merge?: boolean;
  /** Additional JVM args to append, e.g. `["-Dkotlin.daemon.useFallbackStrategy=true"]` */
  extraArgs?: string[];
}

function toTokens(value: unknown): string[] {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(/\s+/)
    .map((t) => t.trim())
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

/**
 * Update or insert the `org.gradle.jvmargs` property in `android/gradle.properties`.
 *
 * - Removes any existing `-Xmx` and `-XX:MaxMetaspaceSize` tokens
 * - Adds the configured values
 * - When `merge` is true (default), preserves other existing tokens
 * - Appends any `extraArgs` last, then deduplicates all tokens
 */
const withGradleJvmArgsImpl: ConfigPlugin<WithGradleJvmArgsProps> = (config, props = {}) => {
  const desiredXmx =
    typeof props.xmx === 'string' && props.xmx.trim() ? props.xmx.trim() : '2048m';
  const desiredMetaspace =
    typeof props.maxMetaspace === 'string' && props.maxMetaspace.trim()
      ? props.maxMetaspace.trim()
      : '512m';
  const merge = props.merge !== false;
  const extraArgs = sanitizeExtraArgs(props.extraArgs);

  return withGradleProperties(config, (cfg) => {
    const key = 'org.gradle.jvmargs';
    const gradleProps = Array.isArray(cfg.modResults) ? cfg.modResults : [];

    const idx = gradleProps.findIndex(
      (p) => p != null && p.type === 'property' && p.key === key,
    );
    const existingProp = idx >= 0 ? gradleProps[idx] : null;
    const existingValue =
      existingProp?.type === 'property' ? String(existingProp.value ?? '') : '';
    const existingTokens = toTokens(existingValue);

    const unmanagedTokens = existingTokens.filter(
      (t) => !/^-Xmx\S+$/.test(t) && !/^-XX:MaxMetaspaceSize=\S+$/.test(t),
    );

    const nextTokens: string[] = [
      `-Xmx${desiredXmx}`,
      `-XX:MaxMetaspaceSize=${desiredMetaspace}`,
      ...(merge ? unmanagedTokens : []),
      ...extraArgs,
    ];

    const value = uniqueTokens(nextTokens).join(' ');

    if (idx >= 0 && existingProp?.type === 'property') {
      gradleProps[idx] = { ...existingProp, value };
    } else {
      gradleProps.push({ type: 'property', key, value });
    }

    cfg.modResults = gradleProps;
    return cfg;
  });
};

const withGradleJvmArgs: ConfigPlugin<WithGradleJvmArgsProps> = createRunOncePlugin(
  withGradleJvmArgsImpl,
  pkg.name,
  pkg.version,
);

export default withGradleJvmArgs;
