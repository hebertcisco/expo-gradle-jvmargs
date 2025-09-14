import type { ConfigPlugin } from '@expo/config-plugins';

export interface WithGradleJvmArgsProps {
  /** Value for `-Xmx`, e.g. `2048m` */
  xmx?: string;
  /** Value for `-XX:MaxMetaspaceSize`, e.g. `512m` */
  maxMetaspace?: string;
  /**
   * Merge with existing `org.gradle.jvmargs` tokens rather than overwriting all values.
   * When `true`, the plugin removes any existing `-Xmx*` and `-XX:MaxMetaspaceSize=*` tokens
   * then adds the configured values, leaving any other tokens intact.
   * Default: `true`.
   */
  merge?: boolean;
  /** Additional JVM args to append (e.g., ["-Dkotlin.daemon.useFallbackStrategy=true"]). */
  extraArgs?: string[];
}

declare const withGradleJvmArgs: ConfigPlugin<WithGradleJvmArgsProps>;

export = withGradleJvmArgs;
