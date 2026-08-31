import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bilopo.nightfallzombies',
  appName: 'Nightfall Zombies',
  webDir: 'www',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'NightfallZombies'
  }
};

export default config;
