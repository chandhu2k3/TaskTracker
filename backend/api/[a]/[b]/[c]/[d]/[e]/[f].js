// Vercel filesystem route: /api/*/*/*/*/*/* (e.g. /api/templates/:id/apply/:y/:m/:w).
// Deepest route in this API. Re-exports the real Express app.
module.exports = require("../../../../../../server");
