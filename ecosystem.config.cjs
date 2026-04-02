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
      META_APP_ID: process.env.META_APP_ID,
      CRM_BASE_URL: process.env.CRM_BASE_URL || "https://crm.casaldotrafego.com",
      CRM_SYNC_TOKEN: process.env.CRM_SYNC_TOKEN || "b1ld3r-crm-s3cr3t-k3y-gener4t3d-f0r-d3v-m0d3-123456"
    }
  }]
}
