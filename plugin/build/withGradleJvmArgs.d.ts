import type { ConfigPlugin } from '@expo/config-plugins';
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
declare const withGradleJvmArgs: ConfigPlugin<WithGradleJvmArgsProps>;
export default withGradleJvmArgs;
