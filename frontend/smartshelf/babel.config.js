module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Transforms import.meta so the web bundle works as a classic script in Chrome.
          // Without this, #root stays blank with: "Cannot use 'import.meta' outside a module".
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};
