
const express = require('express');
const path = require('path');
const app = express();

// Azure App Service sets the PORT environment variable.
// Default to 8080 if not set (common for containerized apps).
const port = process.env.PORT || 8080;

// Serve static files from the root directory with cache settings
app.use(express.static(__dirname, {
  maxAge: '1d', // Cache static assets for 1 day
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // Never cache index.html to ensure updates are seen immediately
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Handle SPA routing: redirects all non-file requests to index.html
app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Ready for Azure deployment`);
});
