const version = process.env.COCODEAI_LOCAL_VERSION ?? '999.0.0-local';
const packageUrl = process.env.COCODEAI_LOCAL_PACKAGE_URL ?? 'cocodeai-local';
const buildTime = process.env.COCODEAI_LOCAL_BUILD_TIME ?? new Date().toISOString();

process.env.COCODEAI_LOCAL_SKIP_REMOTE_PREFETCH ??= '1';

Object.assign(globalThis, {
  MACRO: {
    VERSION: version,
    PACKAGE_URL: packageUrl,
    NATIVE_PACKAGE_URL: packageUrl,
    BUILD_TIME: buildTime,
    FEEDBACK_CHANNEL: 'local',
    VERSION_CHANGELOG: '',
    ISSUES_EXPLAINER: '',
  },
});
// Switch to the current workspace
if (process.env.CALLER_DIR) {
  process.chdir(process.env.CALLER_DIR);
}