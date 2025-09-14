import type { ConfigPlugin } from '@expo/config-plugins';

export interface WithGradleJvmArgsProps {
  /** Value for `-Xmx`, e.g. `2048m` */
  xmx?: string;
  /** Value for `-XX:MaxMetaspaceSize`, e.g. `512m` */
  maxMetaspace?: string;
}

declare const withGradleJvmArgs: ConfigPlugin<WithGradleJvmArgsProps>;

export = withGradleJvmArgs;
