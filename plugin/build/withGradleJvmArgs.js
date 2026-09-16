"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("@expo/config-plugins");
const package_json_1 = __importDefault(require("../../package.json"));
/** Gradle's documented build-VM defaults beyond heap/metaspace (config_gradle / build_environment). */
const GRADLE_SAFETY_ARGS = [
    '-XX:+HeapDumpOnOutOfMemoryError',
    '-Dfile.encoding=UTF-8',
];
const JVM_ARGS_KEY = 'org.gradle.jvmargs';
const KOTLIN_DAEMON_JVMARGS_KEY = 'kotlin.daemon.jvmargs';
const MEMORY_SIZE_RE = /^\d+[kKmMgGtT]?$/;
const XMX_RE = /^-Xmx\S+$/i;
const MAX_METASPACE_RE = /^-XX:MaxMetaspaceSize=\S+$/i;
const FILE_ENCODING_RE = /^-Dfile\.encoding=/i;
const HEAP_DUMP_OOM_RE = /^-XX:\+HeapDumpOnOutOfMemoryError$/i;
function toTokens(value) {
    var _a;
    if (!value || typeof value !== 'string')
        return [];
    // Split on whitespace while respecting simple quoted tokens from Gradle defaults.
    const matches = (_a = value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)) !== null && _a !== void 0 ? _a : [];
    return matches
        .map((t) => {
        const trimmed = t.trim();
        if (trimmed.length >= 2 &&
            ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
                (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
            return trimmed.slice(1, -1).trim();
        }
        return trimmed;
    })
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
    if (!Array.isArray(extraArgs))
        return [];
    return extraArgs.map((s) => String(s).trim()).filter(Boolean);
}
function normalizeMemorySize(raw, fallback) {
    if (typeof raw !== 'string')
        return fallback;
    const trimmed = raw.trim();
    if (!trimmed)
        return fallback;
    if (!MEMORY_SIZE_RE.test(trimmed)) {
        throw new Error(`Invalid memory size "${trimmed}". Expected JVM size notation such as "2048m" or "2g".`);
    }
    // Canonicalize unit suffix (Gradle/JVM accept either case; keep values stable across machines).
    return trimmed.replace(/([kKmMgGtT])$/, (unit) => unit.toLowerCase());
}
function upsertProperty(items, key, value) {
    const next = Array.isArray(items) ? [...items] : [];
    const idx = next.findIndex((p) => p.type === 'property' && p.key === key);
    if (idx >= 0) {
        next[idx] = { type: 'property', key, value };
        return next;
    }
    next.push({ type: 'property', key, value });
    return next;
}
function isManagedMemoryToken(token) {
    return XMX_RE.test(token) || MAX_METASPACE_RE.test(token);
}
function isGradleSafetyConflict(token) {
    return FILE_ENCODING_RE.test(token) || HEAP_DUMP_OOM_RE.test(token);
}
function buildJvmArgsValue(props, existingValue) {
    const desiredXmx = normalizeMemorySize(props.xmx, '2048m');
    const desiredMetaspace = normalizeMemorySize(props.maxMetaspace, '512m');
    const merge = props.merge !== false;
    const includeGradleDefaults = props.includeGradleDefaults !== false;
    // Plugin-managed memory options always win over extras / existing tokens.
    let extraArgs = sanitizeExtraArgs(props.extraArgs).filter((t) => !isManagedMemoryToken(t));
    if (includeGradleDefaults) {
        extraArgs = extraArgs.filter((t) => !isGradleSafetyConflict(t));
    }
    const existingTokens = toTokens(existingValue);
    let unmanagedTokens = existingTokens.filter((t) => !isManagedMemoryToken(t));
    // Setting org.gradle.jvmargs replaces daemon defaults; when we restore safety flags,
    // drop conflicting encoding / HeapDump tokens so the final line stays unambiguous.
    if (includeGradleDefaults) {
        unmanagedTokens = unmanagedTokens.filter((t) => !isGradleSafetyConflict(t));
    }
    const nextTokens = [
        `-Xmx${desiredXmx}`,
        `-XX:MaxMetaspaceSize=${desiredMetaspace}`,
        ...(merge ? unmanagedTokens : []),
        ...(includeGradleDefaults ? [...GRADLE_SAFETY_ARGS] : []),
        ...extraArgs,
    ];
    return uniqueTokens(nextTokens).join(' ');
}
/**
 * Update or insert the `org.gradle.jvmargs` property in `android/gradle.properties`.
 *
 * - Removes any existing `-Xmx` and `-XX:MaxMetaspaceSize` tokens
 * - Adds the configured values
 * - When `merge` is true (default), preserves other existing tokens
 * - Optionally restores Gradle safety defaults that are dropped when the property is set
 * - Appends any `extraArgs` last, then deduplicates all tokens
 * - Optionally sets `kotlin.daemon.jvmargs` for the separate Kotlin compiler daemon
 */
const withGradleJvmArgsImpl = (config, props = {}) => {
    return (0, config_plugins_1.withGradleProperties)(config, (cfg) => {
        var _a;
        const gradleProps = Array.isArray(cfg.modResults)
            ? cfg.modResults
            : [];
        const existingIdx = gradleProps.findIndex((p) => p.type === 'property' && p.key === JVM_ARGS_KEY);
        const existingProp = existingIdx >= 0 ? gradleProps[existingIdx] : null;
        const existingValue = (existingProp === null || existingProp === void 0 ? void 0 : existingProp.type) === 'property' ? String((_a = existingProp.value) !== null && _a !== void 0 ? _a : '') : '';
        let nextProps = upsertProperty(gradleProps, JVM_ARGS_KEY, buildJvmArgsValue(props, existingValue));
        if (typeof props.kotlinDaemonJvmArgs === 'string') {
            const kotlinValue = props.kotlinDaemonJvmArgs.trim();
            if (kotlinValue) {
                nextProps = upsertProperty(nextProps, KOTLIN_DAEMON_JVMARGS_KEY, kotlinValue);
            }
        }
        cfg.modResults = nextProps;
        return cfg;
    });
};
const withGradleJvmArgs = (0, config_plugins_1.createRunOncePlugin)(withGradleJvmArgsImpl, package_json_1.default.name, package_json_1.default.version);
exports.default = withGradleJvmArgs;
