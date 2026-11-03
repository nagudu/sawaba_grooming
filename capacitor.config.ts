import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ng.sawaba.groomingstudio',
  appName: 'SAWABA Grooming Studio',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
