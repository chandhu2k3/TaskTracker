// Vercel filesystem route: /api/* (one segment, e.g. /api/ping).
// Re-exports the real Express app; original URL is preserved by the platform.
module.exports = require("../server");
