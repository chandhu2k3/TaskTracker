// Vercel filesystem route: /api/*/*/*/*/* (e.g. /api/tasks/analytics/category/Work).
// Re-exports the real Express app; original URL is preserved by the platform.
module.exports = require("../../../../../server");
