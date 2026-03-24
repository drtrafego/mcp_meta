require('dotenv').config();

module.exports = {
  apps: [{
    name: "meta-ads-mcp",
    script: "./dist/index.js",
    env: {
      TRANSPORT: "http",
      PORT: 3099,
      META_ADS_ACCESS_TOKEN: process.env.META_ADS_ACCESS_TOKEN,
      META_APP_SECRET: process.env.META_APP_SECRET,
      META_APP_ID: process.env.META_APP_ID
    }
  }]
}
