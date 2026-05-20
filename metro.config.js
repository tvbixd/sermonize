// Local Metro config so that when Scribe lives inside a parent monorepo
// (e.g. Budgetplanner/apps/mobile/scribe), Metro does NOT walk up and
// pick up the parent's metro.config.js.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Pin Metro to this project so it doesn't scan upward into a parent workspace.
config.projectRoot = __dirname;
config.watchFolders = [__dirname];

module.exports = config;
