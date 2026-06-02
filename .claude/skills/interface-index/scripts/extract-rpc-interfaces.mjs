#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function usage() {
  console.error(`Usage:
  node extract-rpc-interfaces.mjs --root <repo> [--proto-dir <dir>] [--format domains|summary]

Options:
  --root       Repository root. Defaults to current directory.
  --proto-dir  Directory to scan. May be repeated. Defaults to all tracked-looking *.proto under root.
  --format     Output format. Defaults to domains. The domains format omits request/response details.`);
}

function readOption(name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function readRepeated(name) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1]) {
      values.push(args[i + 1]);
      i += 1;
    }
  }
  return values;
}

if (args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

const root = path.resolve(readOption('--root') || process.cwd());
const protoDirs = readRepeated('--proto-dir').map((dir) => path.resolve(root, dir));
const format = readOption('--format') || 'domains';
const ignoredParts = new Set([
  '.git',
  '.idea',
  '.gradle',
  '.mvn',
  'node_modules',
  'target',
  'build',
  'dist',
  'out',
  'generated-sources',
  'generated-test-sources',
  'classes',
  'test-classes',
]);

function shouldIgnore(filePath) {
  const rel = path.relative(root, filePath);
  return rel.split(path.sep).some((part) => ignoredParts.has(part));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldIgnore(fullPath)) continue;
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.proto')) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripInlineBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    const lines = match.split(/\r?\n/).length - 1;
    return lines > 0 ? '\n'.repeat(lines) : ' ';
  });
}

function parseProto(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const text = stripInlineBlockComments(raw);
  const packageMatch = text.match(/^\s*package\s+([A-Za-z0-9_.]+)\s*;/m);
  const relPath = path.relative(root, filePath);
  const results = [];
  const services = [];
  const serviceRegex = /^\s*service\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm;

  for (const serviceMatch of text.matchAll(serviceRegex)) {
    const service = serviceMatch[1];
    const serviceStart = serviceMatch.index;
    const serviceStartLine = text.slice(0, serviceStart).split(/\r?\n/).length;
    services.push({
      package: packageMatch?.[1] || '',
      service,
      source: relPath,
      line: serviceStartLine,
    });
    const bodyStart = text.indexOf('{', serviceStart);
    let depth = 0;
    let bodyEnd = -1;
    for (let i = bodyStart; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1;
      if (text[i] === '}') depth -= 1;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    }
    if (bodyStart === -1 || bodyEnd === -1) continue;
    const body = text.slice(bodyStart + 1, bodyEnd);
    const rpcRegex = /\brpc\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\)\s*returns\s*\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\)\s*(?:\{[\s\S]*?\})?\s*;/g;

    for (const rpcMatch of body.matchAll(rpcRegex)) {
      results.push({
        package: packageMatch?.[1] || '',
        service,
        method: rpcMatch[1],
        source: relPath,
      });
    }
  }
  return { interfaces: results, services };
}

function buildDomainRecords(items) {
  const byFile = new Map();
  for (const item of items) {
    if (!byFile.has(item.source)) {
      byFile.set(item.source, {
        source: item.source,
        package: item.package,
        services: new Map(),
      });
    }
    const fileRecord = byFile.get(item.source);
    if (!fileRecord.services.has(item.service)) {
      fileRecord.services.set(item.service, []);
    }
    fileRecord.services.get(item.service).push(item.method);
  }

  return [...byFile.values()]
    .sort((a, b) => a.source.localeCompare(b.source))
    .map((record) => ({
      source: record.source,
      package: record.package,
      services: [...record.services.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([service, methods]) => ({
          service,
          methods: [...new Set(methods)].sort(),
        })),
    }));
}

const scanRoots = protoDirs.length > 0 ? protoDirs : [root];
const protoFiles = [...new Set(scanRoots.flatMap((dir) => walk(dir)))].sort();
const parsedFiles = protoFiles.map(parseProto);
const interfaces = parsedFiles.flatMap((parsed) => parsed.interfaces);
const declaredServices = parsedFiles.flatMap((parsed) => parsed.services);

if (format === 'domains') {
  for (const record of buildDomainRecords(interfaces)) {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  }
} else if (format === 'summary') {
  const services = new Set(interfaces.map((item) => item.service));
  const emptyServices = declaredServices.filter((service) => !services.has(service.service));
  const byFile = new Map();
  for (const item of interfaces) {
    byFile.set(item.source, (byFile.get(item.source) || 0) + 1);
  }
  console.log(`Root: ${root}`);
  console.log(`Proto files: ${protoFiles.length}`);
  console.log(`Services with RPC: ${services.size}`);
  console.log(`Declared services: ${declaredServices.length}`);
  console.log(`Empty services: ${emptyServices.length}`);
  console.log(`RPC methods: ${interfaces.length}`);
  if (emptyServices.length > 0) {
    console.log('Empty service declarations:');
    emptyServices.forEach((service) => console.log(`  ${service.service}\t${service.source}:${service.line}`));
  }
  console.log('Top files:');
  [...byFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([file, count]) => console.log(`  ${count}\t${file}`));
} else {
  usage();
  process.exit(2);
}
