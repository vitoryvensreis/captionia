'use strict';
const fs = require('fs');
const source = fs.readFileSync('CaptionIA/js/main.js', 'utf8');
const match = source.match(/CURRENT_VERSION='([^']+)'/);
if (!match) {
  console.error('CURRENT_VERSION não encontrado em CaptionIA/js/main.js');
  process.exit(1);
}
process.stdout.write(match[1]);
