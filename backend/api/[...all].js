// Vercel filesystem catch-all for every /api/* path.
//
// Why this exists: the root server.js function is reached via a vercel.json
// rewrite (/(.*) -> /server.js). Vercel invokes the function with the
// REWRITTEN path (/server.js) instead of the original URL, so Express sees
// "Cannot GET /server.js" for every /api/* request (production 404 storm).
// A file under api/ is routed by the platform with the ORIGINAL URL
// preserved, which is guaranteed by Vercel's filesystem routing.
//
// This wrapper re-exports the real Express app; no logic lives here.
module.exports = require("../server");
