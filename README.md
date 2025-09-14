<p>
  <a href="https://github.com/hebertcisco/expo-gradle-jvmargs/">
    <img
      src=".github/resources/expo-gradle-jvmargs.svg"
      alt="expo-gradle-jvmargs"
      height="64" />
  </a>
</p>

# Contributing

Contributions are very welcome! Please refer to guidelines described in the [contributing guide](https://github.com/hebertcisco/expo-gradle-jvmargs#contributing).

## Usage

- Install:
  - `npm i -D expo-gradle-jvmargs`

- Add the plugin to your app config (use the package name):

  - app.json:

    ```json
    {
      "expo": {
        "plugins": [["expo-gradle-jvmargs", { "xmx": "2048m", "maxMetaspace": "512m" }]]
      }
    }
    ```

  - app.config.js:

    ```js
    module.exports = {
      expo: {
        plugins: [["expo-gradle-jvmargs", { xmx: "2048m", maxMetaspace: "512m" }]],
      },
    };
    ```

- What it does:
  - Ensures `android/gradle.properties` contains a single normalized line for `org.gradle.jvmargs`.
  - Sets `-Xmx` and `-XX:MaxMetaspaceSize` to your desired values, removing duplicates.
  - Normalizes the file on write to keep only the plugin-managed JVM args.
