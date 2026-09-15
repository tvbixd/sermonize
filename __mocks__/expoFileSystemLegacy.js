// Test mock for `expo-file-system/legacy` (ESM in node_modules, not transformed
// by ts-jest). The verse cache treats the store as empty and writes as no-ops.
module.exports = {
  documentDirectory: 'file:///mock/',
  getInfoAsync: async () => ({ exists: false }),
  readAsStringAsync: async () => '',
  writeAsStringAsync: async () => undefined,
  moveAsync: async () => undefined,
  copyAsync: async () => undefined,
};
