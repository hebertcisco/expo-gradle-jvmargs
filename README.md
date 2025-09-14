<p>
  <a href="https://github.com/hebertcisco/expo-gradle-jvmargs/">
    <img
      src=".github/resources/expo-gradle-jvmargs.svg"
      alt="expo-gradle-jvmargs"
      height="64" />
  </a>
</p>

# expo-gradle-jvmargs

Expo config plugin to manage `org.gradle.jvmargs` in `android/gradle.properties`.
It ensures `-Xmx` and `-XX:MaxMetaspaceSize` are set, with an option to merge or fully normalize the value.

## Why

- Prevents Gradle OOM issues by making memory limits explicit.
- Eliminates duplicate or conflicting JVM args that can creep into projects.
- Keeps the file normalized so the values remain stable across machines and builds.

## Requirements

- Expo projects that support config plugins (Managed or Bare).
- Runs anywhere config plugins are applied: EAS Build, `expo prebuild`, `expo run:android`.
- Works great with Continuous Native Generation (CNG) in newer Expo workflows.

## Install

```bash
npm i -D expo-gradle-jvmargs
# or
yarn add -D expo-gradle-jvmargs
```

## Usage

Add the plugin to your app config using the package name.

- app.json

```json
{
  "expo": {
    "plugins": [["expo-gradle-jvmargs", { "xmx": "2048m", "maxMetaspace": "512m" }]]
  }
}
```

- app.config.js

```js
module.exports = {
  expo: {
    plugins: [["expo-gradle-jvmargs", { xmx: "2048m", maxMetaspace: "512m" }]],
  },
};
```

### Options

- `xmx`: Java heap size (e.g., `1024m`, `2048m`, `4g`). Default: `2048m`.
- `maxMetaspace`: JVM metaspace size (e.g., `256m`, `512m`). Default: `512m`.
- `merge`: When `true`, preserves any existing `org.gradle.jvmargs` tokens other than `-Xmx*` and `-XX:MaxMetaspaceSize=*`. Default: `true`.
- `extraArgs`: Additional JVM args to append (e.g., `["-Dkotlin.daemon.useFallbackStrategy=true"]`).

Units follow standard JVM notation: `m` for megabytes, `g` for gigabytes.

### What It Does

- Ensures a single `org.gradle.jvmargs` entry exists in `android/gradle.properties`.
- Always sets `-Xmx<xmx>` and `-XX:MaxMetaspaceSize=<maxMetaspace>`.
- When `merge` is true (default), preserves other existing tokens and appends any `extraArgs`.
- When `merge` is false, fully normalizes the value to only the plugin-managed tokens (plus `extraArgs`).

## Verify Locally

If you’re using the Managed workflow and want to confirm the output locally:

```bash
# Generate the native Android project
npx expo prebuild -p android

# Check the resulting file
cat android/gradle.properties
```

You should see a normalized line similar to:

```
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m [other tokens if merge=true]

### Continuous Native Generation (CNG)

In projects using Continuous Native Generation, config plugins are applied automatically during development and builds. Keep the plugin listed under `expo.plugins` and use `expo run:android` or EAS Build — no manual prebuild is required. See Expo docs for details.
```

## Troubleshooting

- Gradle still runs out of memory: Increase `xmx` (e.g., `4096m`) and/or `maxMetaspace`.
- Plugin appears to do nothing: Ensure it’s listed in your app config and that you’re building through a path that runs config plugins (`expo prebuild`, `expo run:android`, or EAS Build`).
- I need other JVM args: Use `merge: true` (default) and/or `extraArgs` to retain or add additional flags.

## FAQ

- Why only heap and metaspace? These are the most common and impactful settings for Gradle memory stability across environments.
- Do I need to commit `android/gradle.properties`? In Managed projects, it’s generated; commit behavior is up to your workflow. The plugin ensures the property is normalized either way.
- Will it conflict with other plugins? This plugin updates only the `org.gradle.jvmargs` property. With `merge: true`, other tokens are preserved; set `merge: false` if you want strict normalization.

## References

- Expo config plugins: https://docs.expo.dev/config-plugins/plugins/
- Intro to config plugins: https://docs.expo.dev/config-plugins/introduction/
- App config: https://docs.expo.dev/workflow/configuration
- Continuous Native Generation: https://docs.expo.dev/workflow/continuous-native-generation
- Config plugin dev/debugging: https://docs.expo.dev/config-plugins/development-and-debugging/

## Contributing

Contributions are very welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and PR tips.

### Local Development

- Clone the repo and install dev deps.
- Link or file‑based test in an Expo app by referencing the package name in your app config.
- Use `expo prebuild -p android` in a test app to verify the resulting `gradle.properties`.

### Testing

- Unit tests use Jest with a mock of `@expo/config-plugins`.
- Run tests locally after installing dev deps: `npm i -D jest` then `npm test`.

## License

MIT © @hebertcisco
