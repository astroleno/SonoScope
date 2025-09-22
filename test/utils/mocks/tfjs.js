module.exports = {
  __esModule: true,
  default: {},
  tensor: () => ({}),
  tidy: (fn) => (typeof fn === 'function' ? fn() : undefined),
};
