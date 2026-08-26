'use strict';

// Placeholder build step for ingest. Right now it just verifies the locally-linked
// @openrobops/iso21423 package resolves and loads correctly. As the ORO-side ISO 21423
// integration grows (bridge module, config validation, etc.), extend this script rather
// than adding a separate one.

try {
  const iso21423 = require('@openrobops/iso21423');
  if (!iso21423 || typeof iso21423.SDK_NAME !== 'string') {
    throw new Error('unexpected @openrobops/iso21423 export shape');
  }
  console.log(`build: @openrobops/iso21423 resolved OK (${iso21423.SDK_NAME})`);
} catch (err) {
  console.error('build: failed to resolve @openrobops/iso21423');
  console.error(err);
  process.exit(1);
}
