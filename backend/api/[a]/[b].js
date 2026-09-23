// Vercel filesystem route: /api/*/* (e.g. /api/sleep/active).
// Re-exports the real Express app; original URL is preserved by the platform.
module.exports = require("../../server");
