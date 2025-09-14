<p>
  <a href="https://github.com/hebertcisco/expo-gradle-jvmargs/">
    <img
      src=".github/resources/expo-gradle-jvmargs.svg"
      alt="expo-gradle-jvmargs"
      height="64" />
  </a>
</p>

# expo-gradle-jvmargs

Expo config plugin that enforces a single, normalized `org.gradle.jvmargs` line in `android/gradle.properties`, setting only `-Xmx` and `-XX:MaxMetaspaceSize` to the values you choose.

## Why

- Prevents Gradle OOM issues by making memory limits explicit.
- Eliminates duplicate or conflicting JVM args that can creep into projects.
- Keeps the file normalized so the values remain stable across machines and builds.

## Requirements

- Works in Expo projects that support config plugins (Managed or Bare).
- Effective during EAS Build, `expo prebuild`, or `expo run:android` where the Android project exists or is generated.

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

Units follow standard JVM notation: `m` for megabytes, `g` for gigabytes.

### What It Does

- Ensures exactly one `org.gradle.jvmargs` entry exists in `android/gradle.properties`.
- Sets it to `-Xmx<xmx> -XX:MaxMetaspaceSize=<maxMetaspace>` and removes any previous values for that key.
- Normalizes the file content so only the plugin-managed JVM args remain for that property.

> Important: The plugin intentionally overwrites the entire `org.gradle.jvmargs` value to include only `-Xmx` and `-XX:MaxMetaspaceSize`. If you need additional JVM options under that key, this plugin is not a fit as-is; please open an issue to discuss support for allow‑listing additional args.

## Verify Locally

If you’re using the Managed workflow and want to confirm the output locally:

```bash
# Generate the native Android project
npx expo prebuild -p android

# Check the resulting file
cat android/gradle.properties
```

You should see a single normalized line similar to:

```
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
```

## Troubleshooting

- Gradle still runs out of memory: Increase `xmx` (e.g., `4096m`) and/or `maxMetaspace`.
- Plugin appears to do nothing: Ensure it’s listed in your app config and that you’re building through a path that runs config plugins (`expo prebuild`, `expo run:android`, or EAS Build`).
- I need other JVM args: Not currently supported—this plugin purposely normalizes to only two flags. Consider filing an issue with your use case.

## FAQ

- Why only heap and metaspace? These are the most common and impactful settings for Gradle memory stability across environments.
- Do I need to commit `android/gradle.properties`? In Managed projects, it’s generated; commit behavior is up to your workflow. The plugin ensures the property is normalized either way.
- Will it conflict with other plugins? It removes duplicates and forces a single value for `org.gradle.jvmargs`, which may conflict if another tool expects to append custom JVM args there.

## Contributing

Contributions are very welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and PR tips.

### Local Development

- Clone the repo and install dev deps.
- Link or file‑based test in an Expo app by referencing the package name in your app config.
- Use `expo prebuild -p android` in a test app to verify the resulting `gradle.properties`.

## License

MIT © @hebertcisco
