// Local development entry point — starts the HTTP server
// For Vercel serverless, see /api/index.ts at the repo root

import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`\n🚀 API server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV ?? 'development'}\n`);
});
