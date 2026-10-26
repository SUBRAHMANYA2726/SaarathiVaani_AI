import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vocalis.ai",
  appName: "Vocalis AI",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
