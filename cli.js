#!/usr/bin/env node
/**
 * Minimal CLI to run the GenSON runtime library against a JSON schema.
 * Usage:
 *   node cli.js --input example.json
 */

import fs from 'fs';
import path from 'path';
const { evaluate } = require('./genson.js');

const args = process.argv.slice(2);
const idx = args.findIndex(a => a === '--input' || a === '-i');
const inputPath = idx >= 0 ? args[idx + 1] : 'example.json';

const abs = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
const json = JSON.parse(fs.readFileSync(abs, 'utf8'));
const output = evaluate(json);
process.stdout.write(String(output) + '\n');


