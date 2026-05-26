import { LANGUAGE_HINTS, RUNTIME_CONFIG } from '../config/constants.js';

export function detectLanguage(fileEntries) {
  const scores = { node: 0, python: 0 };

  for (const entry of fileEntries) {
    const name = entry.entryName || entry.name || '';
    const basename = name.split('/').pop() || name;
    if (!basename) continue;

    for (const hint of LANGUAGE_HINTS) {
      if (hint.files.includes(basename)) {
        scores[hint.name] = (scores[hint.name] || 0) + hint.weight;
      }
    }
  }

  if (scores.node === 0 && scores.python === 0) {
    const jsCount = fileEntries.filter(e => {
      const n = e.entryName || e.name || '';
      return n.endsWith('.js') || n.endsWith('.mjs') || n.endsWith('.cjs');
    }).length;
    const pyCount = fileEntries.filter(e => {
      const n = e.entryName || e.name || '';
      return n.endsWith('.py');
    }).length;

    if (jsCount > pyCount && jsCount > 0) scores.node = jsCount * 2;
    else if (pyCount > 0) scores.python = pyCount * 2;
  }

  if (scores.node === 0 && scores.python === 0) return null;

  if (scores.node > scores.python) return 'node';
  if (scores.python > scores.node) return 'python';

  return null;
}

export function getEntryPoint(files, language) {
  const config = RUNTIME_CONFIG[language];
  if (!config) return null;

  const entryNames = files.map(f => {
    const name = f.entryName || f.name || '';
    return name.replace(/\\/g, '/');
  });

  for (const candidate of config.entryFiles) {
    const match = entryNames.find(n => n === candidate || n.endsWith('/' + candidate));
    if (match) return match;
  }

  const ext = language === 'node' ? '.js' : '.py';
  const rootFiles = entryNames.filter(n => !n.includes('/') && n.endsWith(ext));
  if (rootFiles.length === 1) return rootFiles[0];

  return null;
}

export function detectVersion(files, language) {
  const config = RUNTIME_CONFIG[language];
  if (!config) return null;

  const entryNames = files.map(f => {
    const name = f.entryName || f.name || '';
    return name.replace(/\\/g, '/');
  });

  for (const vf of config.versionFiles) {
    const match = entryNames.find(n => n === vf || n.endsWith('/' + vf));
    if (!match) continue;
    const entry = files.find(f => {
      const n = f.entryName || f.name || '';
      return n.replace(/\\/g, '/') === match;
    });
    if (entry && entry.getData) {
      try {
        const content = entry.getData().toString('utf8').trim();
        if (vf === 'package.json') {
          const pkg = JSON.parse(content);
          if (pkg.engines?.node) return pkg.engines.node;
        }
        if (content) return content;
      } catch {}
    }
  }
  return null;
}

export function getDependencyFile(files, language) {
  const config = RUNTIME_CONFIG[language];
  if (!config) return null;

  const entryNames = files.map(f => {
    const name = f.entryName || f.name || '';
    return name.replace(/\\/g, '/');
  });

  const match = entryNames.find(n => n === config.depFile || n.endsWith('/' + config.depFile));
  if (match) {
    return files.find(f => {
      const n = f.entryName || f.name || '';
      return n.replace(/\\/g, '/') === match;
    });
  }
  return null;
}
