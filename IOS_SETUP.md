# Nightfall Zombies — iPhone testing with Xcode

## Requirements
- Mac with Apple silicon (M1/M2/M3/M4 or newer)
- Xcode installed and opened at least once
- Node.js installed
- iPhone connected to the Mac
- Apple Account signed in to Xcode

## First installation
```bash
git clone https://github.com/Bilopo/Nightfall-Zombies.git
cd Nightfall-Zombies
npm run ios:first-run
```

The script installs dependencies, builds the mobile web bundle, creates/synchronizes the Capacitor iOS project, applies landscape/fullscreen settings and opens Xcode.

## In Xcode
1. Select the `App` project in the left sidebar.
2. Open **Signing & Capabilities**.
3. Enable **Automatically manage signing**.
4. Select your Apple Account / Personal Team in **Team**.
5. Keep the bundle identifier unique (`com.bilopo.nightfallzombies` by default; change it if Xcode reports a conflict).
6. Connect and unlock the iPhone, tap **Trust** if prompted.
7. Select the iPhone as the Run destination at the top of Xcode.
8. Enable Developer Mode on the iPhone if requested.
9. Press the ▶ Run button.

## After future game changes
```bash
git pull
npm run ios:open
```

Then press ▶ in Xcode again.

## Notes
- The native app bundles Three.js locally, so the game runtime does not need the Three.js CDN.
- The PWA service worker is disabled inside the Capacitor shell to avoid stale game builds.
- The iOS target is configured for landscape/fullscreen gameplay.
- A free Xcode Personal Team can install the game on your own iPhone, but provisioning expires periodically and the app must be rebuilt/reinstalled.
