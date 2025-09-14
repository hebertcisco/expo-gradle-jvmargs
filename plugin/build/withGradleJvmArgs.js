// Expo config plugin to ensure Gradle JVM args are set in a predictable way
// Usage in app.json/app.config.js:
//   ["expo-gradle-jvmargs", { "xmx": "2048m", "maxMetaspace": "512m", "merge": true }]

const { withGradleProperties, createRunOncePlugin } = require('@expo/config-plugins');
const pkg = require('../../package.json');

function toTokens(value) {
  if (!value || typeof value !== 'string') return [];
  // Split by whitespace; gradle.properties typically doesn't contain quoted spaces in this field
  return value
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function uniqueTokens(list) {
  const seen = new Set();
  const out = [];
  for (const t of list) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function sanitizeExtraArgs(extraArgs) {
  if (!Array.isArray(extraArgs)) return [];
  return extraArgs
    .map((s) => String(s).trim())
    .filter(Boolean);
}

/**
 * Update or insert the `org.gradle.jvmargs` property in android/gradle.properties.
 * - Removes any existing -Xmx and -XX:MaxMetaspaceSize tokens
 * - Adds configured values
 * - When `merge` is true, preserves other tokens; otherwise overwrites with only the configured tokens
 */
const withGradleJvmArgsImpl = (config, props = {}) => {
  const desiredXmx = typeof props.xmx === 'string' && props.xmx.trim() ? props.xmx.trim() : '2048m';
  const desiredMetaspace =
    typeof props.maxMetaspace === 'string' && props.maxMetaspace.trim()
      ? props.maxMetaspace.trim()
      : '512m';
  const merge = props.merge !== false; // default true
  const extraArgs = sanitizeExtraArgs(props.extraArgs);

  return withGradleProperties(config, (cfg) => {
    const key = 'org.gradle.jvmargs';
    const gradleProps = Array.isArray(cfg.modResults) ? cfg.modResults : [];

    // Find existing property index
    const idx = gradleProps.findIndex((p) => p && p.type === 'property' && p.key === key);
    const existingValue = idx >= 0 ? String(gradleProps[idx].value || '') : '';
    const existingTokens = toTokens(existingValue);

    // Remove tokens managed by this plugin
    const unmanagedTokens = existingTokens.filter(
      (t) => !/^\-Xmx\S+$/.test(t) && !/^\-XX:MaxMetaspaceSize=\S+$/.test(t)
    );

    const nextTokens = [];
    // Always set the two managed tokens first
    nextTokens.push(`-Xmx${desiredXmx}`);
    nextTokens.push(`-XX:MaxMetaspaceSize=${desiredMetaspace}`);

    // Optionally preserve the rest
    if (merge) {
      nextTokens.push(...unmanagedTokens);
    }

    // Append extra args requested by user
    nextTokens.push(...extraArgs);

    const value = uniqueTokens(nextTokens).join(' ');

    if (idx >= 0) {
      gradleProps[idx] = { ...gradleProps[idx], value };
    } else {
      gradleProps.push({ type: 'property', key, value });
    }

    cfg.modResults = gradleProps;
    return cfg;
  });
};

const withGradleJvmArgs = createRunOncePlugin(
  withGradleJvmArgsImpl,
  pkg.name,
  pkg.version
);

module.exports = withGradleJvmArgs;
