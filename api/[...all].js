let appPromise;

module.exports = async (req, res) => {
  if (!appPromise) {
    appPromise = import('../server/src/server.js').then((mod) => mod.default || mod.app);
  }
  const app = await appPromise;
  return app(req, res);
};
