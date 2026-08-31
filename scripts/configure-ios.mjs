import { readFile, writeFile, access } from 'node:fs/promises';

const plist = 'ios/App/App/Info.plist';
try {
  await access(plist);
  let s = await readFile(plist, 'utf8');

  if (!s.includes('<key>UIRequiresFullScreen</key>')) {
    s = s.replace('</dict>', `  <key>UIRequiresFullScreen</key>\n  <true/>\n  <key>UISupportedInterfaceOrientations</key>\n  <array>\n    <string>UIInterfaceOrientationLandscapeLeft</string>\n    <string>UIInterfaceOrientationLandscapeRight</string>\n  </array>\n  <key>UIViewControllerBasedStatusBarAppearance</key>\n  <false/>\n  <key>UIStatusBarHidden</key>\n  <true/>\n</dict>`);
    await writeFile(plist, s, 'utf8');
    console.log('Applied landscape/fullscreen iOS settings.');
  } else {
    console.log('iOS native settings already applied.');
  }
} catch {
  console.log('iOS project not generated yet; native settings skipped.');
}
