//     pm2 start deploy/ecosystem.config.cjs
//     pm2 save
//     pm2 startup

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
