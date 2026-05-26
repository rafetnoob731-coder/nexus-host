export const LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024,
  MAX_FILES_IN_ZIP: 5000,
  MAX_ZIP_COMPRESSION_RATIO: 100,
  MAX_EXTRACTED_SIZE: 500 * 1024 * 1024,
  MAX_FILENAME_LENGTH: 255,
  BANNED_EXTENSIONS: new Set([
    '.exe', '.dll', '.so', '.dylib', '.bin', '.elf',
    '.sh', '.bash', '.zsh', '.fish',
    '.bat', '.cmd', '.ps1', '.vbs', '.scr',
    '.msi', '.jar', '.class', '.war',
    '.app', '.deb', '.rpm', '.apk',
    '.o', '.obj', '.lib', '.a', '.ko',
  ]),
  MAX_DEPTH: 20,
};

export const PATHS = {
  BOTS_ROOT: './bots',
  TEMP_ROOT: './tmp',
};

export const RUNTIME_CONFIG = {
  node: {
    depFile: 'package.json',
    depCommand: 'npm install --production',
    entryFiles: ['index.js', 'main.js', 'bot.js', 'app.js', 'server.js'],
    versionFiles: ['.nvmrc', '.node-version', 'package.json'],
    label: 'Node.js',
  },
  python: {
    depFile: 'requirements.txt',
    depCommand: 'pip install -r requirements.txt --no-cache-dir',
    entryFiles: ['main.py', 'bot.py', 'app.py', 'run.py', 'index.py'],
    versionFiles: ['.python-version', 'runtime.txt', 'Pipfile'],
    label: 'Python',
  },
};

export const LANGUAGE_HINTS = [
  { name: 'node', files: ['package.json'], weight: 10 },
  { name: 'node', files: ['yarn.lock', 'pnpm-lock.yaml', 'package-lock.json'], weight: 8 },
  { name: 'node', files: ['.nvmrc', '.node-version'], weight: 5 },
  { name: 'node', files: ['tsconfig.json'], weight: 6 },
  { name: 'node', files: ['webpack.config.js', 'rollup.config.js', 'vite.config.js'], weight: 4 },
  { name: 'python', files: ['requirements.txt'], weight: 10 },
  { name: 'python', files: ['Pipfile', 'Pipfile.lock', 'poetry.lock'], weight: 8 },
  { name: 'python', files: ['setup.py', 'setup.cfg', 'pyproject.toml'], weight: 7 },
  { name: 'python', files: ['.python-version', 'runtime.txt'], weight: 5 },
  { name: 'python', files: ['main.py', 'bot.py'], weight: 3 },
  { name: 'node', files: ['index.js', 'bot.js'], weight: 3 },
];
