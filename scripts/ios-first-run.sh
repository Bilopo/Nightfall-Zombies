#!/bin/bash
set -e

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install it from https://nodejs.org or with Homebrew."
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode is required. Install Xcode from the Mac App Store, open it once, then rerun this command."
  exit 1
fi

npm install
npm run prepare:mobile

if [ ! -d "ios" ]; then
  npx cap add ios
else
  npx cap sync ios
fi

node scripts/configure-ios.mjs
npx cap sync ios
npx cap open ios
