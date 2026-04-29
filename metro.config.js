const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("glb", "gltf", "bin", "png", "jpg", "jpeg");
config.resolver.sourceExts.push("js", "jsx", "json", "ts", "tsx", "cjs", "mjs");

module.exports = config;
