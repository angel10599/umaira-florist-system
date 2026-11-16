// Vercel serverless entry point.
// Vercel routes all /api/* requests (and optionally all requests via vercel.json rewrites) here.
const { vercelHandler } = require('../server');
module.exports = vercelHandler;
