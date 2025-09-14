// Expo config plugin to ensure Gradle JVM args are set to desired values
// Usage in app.json/app.config.js:
//   ["./app.plugin", { "xmx": "2048m", "maxMetaspace": "512m" }]

const { withGradleProperties, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Update or insert the `org.gradle.jvmargs` property in android/gradle.properties.
 * - Replaces existing -Xmx and -XX:MaxMetaspaceSize values if present
 * - Adds them if missing
 */
module.exports = function withGradleJvmArgs(config, props = {}) {
  const desiredXmx =
    typeof props.xmx === 'string' && props.xmx.trim()
      ? props.xmx.trim()
      : '2048m';
  const desiredMetaspace =
    typeof props.maxMetaspace === 'string' && props.maxMetaspace.trim()
      ? props.maxMetaspace.trim()
      : '512m';

  // First, update the in-memory gradle.properties representation
  config = withGradleProperties(config, (cfg) => {
    const gradleProps = cfg.modResults || [];
    const key = 'org.gradle.jvmargs';
    // Always set only the plugin's values, removing all previous ones
    const normalized = `-Xmx${desiredXmx} -XX:MaxMetaspaceSize=${desiredMetaspace}`;
    // Remove all existing entries for this key
    for (let i = gradleProps.length - 1; i >= 0; i--) {
      if (gradleProps[i] && gradleProps[i].type === 'property' && gradleProps[i].key === key) {
        gradleProps.splice(i, 1);
      }
    }
    gradleProps.push({ type: 'property', key, value: normalized });
    cfg.modResults = gradleProps;
    return cfg;
  });

  // Additionally, ensure the final written file is normalized to only the plugin's values
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      try {
        const projectRoot = cfg.modRequest.projectRoot;
        const gradlePropsPath = path.join(projectRoot, 'android', 'gradle.properties');
        if (!fs.existsSync(gradlePropsPath)) return cfg;

        const desiredLine = `org.gradle.jvmargs=-Xmx${desiredXmx} -XX:MaxMetaspaceSize=${desiredMetaspace}`;
        const raw = await fs.promises.readFile(gradlePropsPath, 'utf8');
        const lines = raw.split(/\r?\n/);
        const kept = lines.filter((line) => !/^\s*org\.gradle\.jvmargs\s*=/.test(line));
        if (kept.length > 0 && kept[kept.length - 1] !== '') kept.push('');
        kept.push(desiredLine);
        const next = kept.join('\n');
        if (next !== raw) {
          await fs.promises.writeFile(gradlePropsPath, next, 'utf8');
        }
      } catch (_e) {
        // Do not fail the build for file system normalization issues
      }
      return cfg;
    },
  ]);

  return config;
};
