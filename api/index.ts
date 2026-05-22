// Vercel serverless entry point
// Vercel picks up this file automatically and wraps it as a serverless function.
// The Express app handles all /api/* routing internally.

import app from '../apps/api/src/app';

export default app;
