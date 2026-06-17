const path = require("node:path");

const root = path.resolve(__dirname, "..");
const backendDir = path.join(root, "backend");

module.exports = {
  apps: [
    {
      name: "pos-backend",
      cwd: backendDir,
      script: "src/server.js",
      interpreter: "node",
      interpreter_args: "--import tsx",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      time: true,
    },
    {
      name: "pos-proxy",
      cwd: root,
      script: "caddy",
      args: "run --config deploy/Caddyfile",
      interpreter: "none",
      autorestart: true,
      time: true,
    },
  ],
};
