jest.mock(
  '@expo/config-plugins',
  () => ({
    withGradleProperties: <T extends { modResults: unknown }>(
      config: T,
      action: (config: T) => T,
    ): T => action(config),
    createRunOncePlugin: <T>(impl: T): T => impl,
  }),
  { virtual: true },
);

import type { ConfigPlugin } from '@expo/config-plugins';

import withGradleJvmArgs, {
  type WithGradleJvmArgsProps,
} from '../plugin/src/withGradleJvmArgs';

type PropertyItem =
  | { type: 'comment'; value: string }
  | { type: 'empty' }
  | { type: 'property'; key: string; value: string | null };

type PluginConfig = {
  modResults: PropertyItem[] | null;
};

type PluginResult = {
  modResults: PropertyItem[];
};

const plugin = withGradleJvmArgs as ConfigPlugin<WithGradleJvmArgsProps> &
  ((config: PluginConfig, props?: WithGradleJvmArgsProps) => PluginResult);

function prop(key: string, value: string | null): PropertyItem {
  return { type: 'property', key, value };
}

function findProperty(
  items: PropertyItem[],
  key: string,
): Extract<PropertyItem, { type: 'property' }> | undefined {
  return items.find(
    (item): item is Extract<PropertyItem, { type: 'property' }> =>
      item.type === 'property' && item.key === key,
  );
}

const SAFETY = '-XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

describe('withGradleJvmArgs config plugin', () => {
  const KEY = 'org.gradle.jvmargs';
  const KOTLIN_KEY = 'kotlin.daemon.jvmargs';

  test('adds default tokens and Gradle safety flags when property is missing', () => {
    const config: PluginConfig = { modResults: [] };
    const result = plugin(config, {});
    const entry = findProperty(result.modResults, KEY);
    expect(entry).toBeTruthy();
    expect(entry?.value).toBe(`-Xmx2048m -XX:MaxMetaspaceSize=512m ${SAFETY}`);
  });

  test('merges by default, preserving unrelated flags', () => {
    const existing = '-Xmx1024m -XX:MaxMetaspaceSize=256m -Dfoo=bar';
    const config: PluginConfig = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, {});
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe(`-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfoo=bar ${SAFETY}`);
  });

  test('strict normalization when merge=false still keeps Gradle safety defaults', () => {
    const existing = '-Xmx1024m -XX:MaxMetaspaceSize=256m -Dfoo=bar -Dbar=baz';
    const config: PluginConfig = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, { merge: false });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe(`-Xmx2048m -XX:MaxMetaspaceSize=512m ${SAFETY}`);
  });

  test('can disable Gradle safety defaults', () => {
    const config: PluginConfig = { modResults: [] };
    const result = plugin(config, { includeGradleDefaults: false });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m');
  });

  test('does not duplicate safety flags already present', () => {
    const existing = `-Xmx512m -XX:MaxMetaspaceSize=256m ${SAFETY}`;
    const config: PluginConfig = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, {});
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe(`-Xmx2048m -XX:MaxMetaspaceSize=512m ${SAFETY}`);
  });

  test('strips quotes from Gradle-style quoted tokens', () => {
    const existing = '-Xmx512m "-XX:MaxMetaspaceSize=384m" -Dkeep=1';
    const config: PluginConfig = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, {});
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe(
      `-Xmx2048m -XX:MaxMetaspaceSize=512m -Dkeep=1 ${SAFETY}`,
    );
    expect(entry?.value).not.toContain('"');
  });

  test('respects custom xmx and metaspace values including gigabyte units', () => {
    const config: PluginConfig = { modResults: [] };
    const result = plugin(config, {
      xmx: '4g',
      maxMetaspace: '768m',
      includeGradleDefaults: false,
    });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx4g -XX:MaxMetaspaceSize=768m');
  });

  test('rejects invalid memory size values', () => {
    const config: PluginConfig = { modResults: [] };
    expect(() => plugin(config, { xmx: 'lots' })).toThrow(/Invalid memory size/);
    expect(() => plugin(config, { maxMetaspace: '512mb' })).toThrow(/Invalid memory size/);
  });

  test('treats blank xmx/maxMetaspace as defaults', () => {
    const config: PluginConfig = { modResults: [] };
    const result = plugin(config, {
      xmx: '   ',
      maxMetaspace: '',
      includeGradleDefaults: false,
    });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m');
  });

  test('appends extraArgs and deduplicates', () => {
    const existing = '-Xmx512m -XX:MaxMetaspaceSize=256m -Dopt=1';
    const config: PluginConfig = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, {
      extraArgs: ['-Dopt=1', '-Dnew=2'],
      includeGradleDefaults: false,
    });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m -Dopt=1 -Dnew=2');
  });

  test('ignores non-array extraArgs', () => {
    const config: PluginConfig = { modResults: [] };
    const result = plugin(config, {
      // Runtime guard: non-array values are ignored.
      extraArgs: 'not-an-array' as unknown as string[],
      includeGradleDefaults: false,
    });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m');
  });

  test('removes duplicates across existing and managed tokens', () => {
    const existing = '-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfoo=bar -Dfoo=bar';
    const config: PluginConfig = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, { includeGradleDefaults: false });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfoo=bar');
  });

  test('handles non-array modResults by creating a fresh property list', () => {
    const config: PluginConfig = { modResults: null };
    const result = plugin(config, { includeGradleDefaults: false });
    expect(Array.isArray(result.modResults)).toBe(true);
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m');
  });

  test('sets kotlin.daemon.jvmargs when provided', () => {
    const config: PluginConfig = { modResults: [prop(KEY, '-Xmx512m')] };
    const result = plugin(config, {
      includeGradleDefaults: false,
      kotlinDaemonJvmArgs: '-Xmx1500m',
    });
    const kotlin = findProperty(result.modResults, KOTLIN_KEY);
    expect(kotlin).toBeTruthy();
    expect(kotlin?.value).toBe('-Xmx1500m');
  });

  test('leaves kotlin.daemon.jvmargs untouched when option omitted', () => {
    const config: PluginConfig = {
      modResults: [prop(KEY, '-Xmx512m'), prop(KOTLIN_KEY, '-Xmx900m')],
    };
    const result = plugin(config, { includeGradleDefaults: false });
    const kotlin = findProperty(result.modResults, KOTLIN_KEY);
    expect(kotlin?.value).toBe('-Xmx900m');
  });

  test('does not write blank kotlinDaemonJvmArgs', () => {
    const config: PluginConfig = { modResults: [] };
    const result = plugin(config, {
      includeGradleDefaults: false,
      kotlinDaemonJvmArgs: '   ',
    });
    expect(findProperty(result.modResults, KOTLIN_KEY)).toBeUndefined();
  });

  test('replaces conflicting file.encoding when restoring Gradle defaults', () => {
    const existing = '-Xmx512m -Dfile.encoding=ISO-8859-1 -Dkeep=1';
    const config: PluginConfig = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, {});
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe(
      `-Xmx2048m -XX:MaxMetaspaceSize=512m -Dkeep=1 ${SAFETY}`,
    );
    expect(entry?.value).not.toContain('ISO-8859-1');
  });

  test('preserves custom file.encoding when includeGradleDefaults is false', () => {
    const existing = '-Xmx512m -Dfile.encoding=ISO-8859-1';
    const config: PluginConfig = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, { includeGradleDefaults: false });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe(
      '-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=ISO-8859-1',
    );
  });

  test('normalizes case-insensitive MaxMetaspaceSize tokens', () => {
    const existing = '-Xmx512m -xx:maxmetaspaceSize=256m -Dkeep=1';
    const config: PluginConfig = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, { includeGradleDefaults: false });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m -Dkeep=1');
  });

  test('updates existing kotlin.daemon.jvmargs in place', () => {
    const config: PluginConfig = {
      modResults: [prop(KEY, '-Xmx512m'), prop(KOTLIN_KEY, '-Xmx900m')],
    };
    const result = plugin(config, {
      includeGradleDefaults: false,
      kotlinDaemonJvmArgs: '-Xmx1500m -XX:MaxMetaspaceSize=384m',
    });
    const kotlinEntries = result.modResults.filter(
      (item): item is Extract<PropertyItem, { type: 'property' }> =>
        item.type === 'property' && item.key === KOTLIN_KEY,
    );
    expect(kotlinEntries).toHaveLength(1);
    expect(kotlinEntries[0]?.value).toBe('-Xmx1500m -XX:MaxMetaspaceSize=384m');
  });

  test('preserves comments and empty lines around updated properties', () => {
    const config: PluginConfig = {
      modResults: [
        { type: 'comment', value: '# generated' },
        { type: 'empty' },
        prop(KEY, '-Xmx512m'),
        prop('android.useAndroidX', 'true'),
      ],
    };
    const result = plugin(config, { includeGradleDefaults: false });
    expect(result.modResults[0]).toEqual({ type: 'comment', value: '# generated' });
    expect(result.modResults[1]).toEqual({ type: 'empty' });
    expect(findProperty(result.modResults, 'android.useAndroidX')?.value).toBe('true');
    expect(findProperty(result.modResults, KEY)?.value).toBe(
      '-Xmx2048m -XX:MaxMetaspaceSize=512m',
    );
  });

  test('ignores memory tokens in extraArgs so xmx/maxMetaspace win', () => {
    const config: PluginConfig = { modResults: [] };
    const result = plugin(config, {
      xmx: '4096m',
      maxMetaspace: '768m',
      includeGradleDefaults: false,
      extraArgs: ['-Xmx999m', '-XX:MaxMetaspaceSize=128m', '-Dkeep=1'],
    });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx4096m -XX:MaxMetaspaceSize=768m -Dkeep=1');
  });

  test('ignores conflicting safety tokens in extraArgs when defaults are enabled', () => {
    const config: PluginConfig = { modResults: [] };
    const result = plugin(config, {
      extraArgs: ['-Dfile.encoding=ISO-8859-1', '-Dkeep=1'],
    });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe(
      `-Xmx2048m -XX:MaxMetaspaceSize=512m ${SAFETY} -Dkeep=1`,
    );
    expect(entry?.value).not.toContain('ISO-8859-1');
  });

  test('canonicalizes uppercase memory unit suffixes', () => {
    const config: PluginConfig = { modResults: [] };
    const result = plugin(config, {
      xmx: '2048M',
      maxMetaspace: '1G',
      includeGradleDefaults: false,
    });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=1g');
  });

  test('is idempotent when applied twice', () => {
    const config: PluginConfig = { modResults: [prop(KEY, '-Xmx512m -Dfoo=bar')] };
    const once = plugin(config, {});
    const twice = plugin({ modResults: [...once.modResults] }, {});
    expect(findProperty(twice.modResults, KEY)?.value).toBe(
      findProperty(once.modResults, KEY)?.value,
    );
  });

  test('strips single-quoted tokens from existing jvmargs', () => {
    const existing = "-Xmx512m '-XX:MaxMetaspaceSize=384m' -Dkeep=1";
    const config: PluginConfig = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, { includeGradleDefaults: false });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m -Dkeep=1');
    expect(entry?.value).not.toContain("'");
  });

  test('treats null property value as empty', () => {
    const config: PluginConfig = {
      modResults: [{ type: 'property', key: KEY, value: null }],
    };
    const result = plugin(config, { includeGradleDefaults: false });
    const entry = findProperty(result.modResults, KEY);
    expect(entry?.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m');
  });
});
