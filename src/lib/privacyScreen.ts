import { registerPlugin } from '@capacitor/core';

// Local Android plugin: android/app/src/main/java/com/nihap/loantracker/PrivacyScreenPlugin.java
interface PrivacyScreenPlugin {
  setEnabled(options: { enabled: boolean }): Promise<void>;
}

export const PrivacyScreen = registerPlugin<PrivacyScreenPlugin>('PrivacyScreen');
