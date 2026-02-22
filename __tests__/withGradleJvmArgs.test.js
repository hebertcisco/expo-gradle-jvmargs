// Mock the Expo config-plugins API used by the plugin
jest.mock('@expo/config-plugins', () => {
  return {
    // Directly run the provided action with the given config
    withGradleProperties: (config, action) => action(config),
    // Pass-through: we don't need run-once semantics in tests
    createRunOncePlugin: (impl) => impl,
  };
}, { virtual: true });

const plugin = require('../plugin/build/withGradleJvmArgs').default;

function prop(key, value) {
  return { type: 'property', key, value };
}

describe('withGradleJvmArgs config plugin', () => {
  const KEY = 'org.gradle.jvmargs';

  test('adds default tokens when property is missing', () => {
    const config = { modResults: [] };
    const result = plugin(config, {});
    const entry = result.modResults.find((p) => p.key === KEY);
    expect(entry).toBeTruthy();
    expect(entry.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m');
  });

  test('merges by default, preserving unrelated flags', () => {
    const existing = '-Xmx1024m -XX:MaxMetaspaceSize=256m -Dfoo=bar';
    const config = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, {});
    const entry = result.modResults.find((p) => p.key === KEY);
    expect(entry.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfoo=bar');
  });

  test('strict normalization when merge=false', () => {
    const existing = '-Xmx1024m -XX:MaxMetaspaceSize=256m -Dfoo=bar -Dbar=baz';
    const config = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, { merge: false });
    const entry = result.modResults.find((p) => p.key === KEY);
    expect(entry.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m');
  });

  test('respects custom xmx and metaspace values', () => {
    const config = { modResults: [] };
    const result = plugin(config, { xmx: '4096m', maxMetaspace: '768m' });
    const entry = result.modResults.find((p) => p.key === KEY);
    expect(entry.value).toBe('-Xmx4096m -XX:MaxMetaspaceSize=768m');
  });

  test('appends extraArgs and deduplicates', () => {
    const existing = '-Xmx512m -XX:MaxMetaspaceSize=256m -Dopt=1';
    const config = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, { extraArgs: ['-Dopt=1', '-Dnew=2'] });
    const entry = result.modResults.find((p) => p.key === KEY);
    // -Dopt=1 is preserved via merge; the duplicate from extraArgs is deduped
    expect(entry.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m -Dopt=1 -Dnew=2');
  });

  test('removes duplicates across existing and managed tokens', () => {
    const existing = '-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfoo=bar -Dfoo=bar';
    const config = { modResults: [prop(KEY, existing)] };
    const result = plugin(config, {});
    const entry = result.modResults.find((p) => p.key === KEY);
    // Only one -Dfoo=bar remains
    expect(entry.value).toBe('-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfoo=bar');
  });
});
