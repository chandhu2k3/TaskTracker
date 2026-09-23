// Vercel filesystem route: /api/*/*/*/* (e.g. /api/tasks/week/2026/8/4).
// Re-exports the real Express app; original URL is preserved by the platform.
module.exports = require("../../../../server");
