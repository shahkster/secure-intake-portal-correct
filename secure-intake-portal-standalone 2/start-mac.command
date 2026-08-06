#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org"
  read -r -p "Press Return to close..."
  exit 1
fi
npm install
if [ ! -f .env.local ]; then
  npm run setup
fi
npx vercel dev
