import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";
import { SubscribePage } from "./SubscribePage";
import { AdminPage } from "./AdminPage";
import { ChatWidget } from "./ChatWidget";

const config: ZudokuConfig = {
  site: {
    title: "Forest River",
    logo: {
      src: {
        light: "https://www.forestriverinc.com/images/logo-reversed.png",
        dark: "https://www.forestriverinc.com/images/logo-reversed.png",
      },
      width: "160px",
    },
    banner: {
      message: "⚠️ API v1 is being retired on May 30, 2026. Please migrate to v2. See the Migration Guide for details.",
      color: "caution",
      dismissible: true,
    },
  },

  metadata: {
    favicon: "https://www.forestriverinc.com/images/favicon.png",
    title: "Forest River Developer Portal",
    description: "Developer documentation and API access for Forest River, Inc.",
  },

  theme: {
    light: {
      primary: "#026957",
      primaryForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#232323",
      card: "#ffffff",
      cardForeground: "#232323",
      popover: "#ffffff",
      popoverForeground: "#232323",
      secondary: "#f0f7f5",
      secondaryForeground: "#026957",
      muted: "#f5f5f5",
      mutedForeground: "#6c757d",
      accent: "#f0f7f5",
      accentForeground: "#026957",
      destructive: "#dc3545",
      destructiveForeground: "#ffffff",
      border: "#e2e2e2",
      input: "#e2e2e2",
      ring: "#026957",
      radius: "0rem",
    },
    dark: {
      primary: "#02a17f",
      primaryForeground: "#ffffff",
      background: "#0f1a17",
      foreground: "#f0f7f5",
      card: "#1a2d28",
      cardForeground: "#f0f7f5",
      popover: "#1a2d28",
      popoverForeground: "#f0f7f5",
      secondary: "#1a2d28",
      secondaryForeground: "#f0f7f5",
      muted: "#1a2d28",
      mutedForeground: "#94a3b8",
      accent: "#1a2d28",
      accentForeground: "#02a17f",
      destructive: "#ef4444",
      destructiveForeground: "#ffffff",
      border: "#2a3d38",
      input: "#2a3d38",
      ring: "#02a17f",
      radius: "0rem",
    },
    fonts: {
      sans: "Montserrat",
      mono: "JetBrains Mono",
    },
    customCss: undefined,
  },

  authentication: {
    type: "auth0",
    domain: "dev-l3ayzqncrfw3ta50.us.auth0.com",
    clientId: "GgoZWZhD9XXpCJC771LkiKtnC3VRk0E9",
    audience: "https://forest-river-demo",
  },

  // Multiple API versions — Zudoku renders a version dropdown automatically
  apis: [
    {
      type: "file",
      input: "../config/routes-v2.oas.json",
      path: "/api",
    },
    {
      type: "file",
      input: "../config/routes-v1.oas.json",
      path: "/api/v1",
    },
  ],

  docs: {
    files: "/pages/**/*.{md,mdx}",
  },

  navigation: [
    {
      type: "category",
      label: "Documentation",
      icon: "book",
      items: [
        { type: "doc", file: "introduction", path: "/", label: "Introduction" },
        { type: "doc", file: "quickstart", label: "Quick Start" },
        { type: "doc", file: "authentication", label: "Authentication" },
        { type: "doc", file: "migration-guide", label: "Migration Guide", icon: "alert-triangle" },
      ],
    },
    {
      type: "link",
      to: "/api",
      label: "API Reference",
      icon: "code",
    },
    {
      type: "custom-page",
      path: "/subscribe",
      label: "Plans",
      icon: "credit-card",
      element: <SubscribePage view="plans" />,
      display: "always",
    },
    {
      type: "custom-page",
      path: "/my-subscriptions",
      label: "My Subscriptions",
      icon: "key",
      element: <SubscribePage view="subscriptions" />,
      display: "always",
    },
    {
      type: "custom-page",
      path: "/admin",
      label: "Admin",
      icon: "shield",
      element: <AdminPage />,
      display: ({ auth }) => {
        const profile = auth.profile as any;
        const roles: string[] = profile?.["https://forest-river-demo/roles"] ?? [];
        return roles.includes("api-admin");
      },
    },
  ],

  slots: {
    "head-navigation-start": <span className="font-semibold text-sm">Forest River</span>,
    "head-navigation-end": <ChatWidget />,
  },

  plugins: [
    createApiIdentityPlugin({
      getIdentities: async (context) => [
        {
          id: "oauth-token",
          label: "OAuth Token",
          authorizeRequest: (request) => {
            return context.authentication?.signRequest(request);
          },
        },
      ],
    }),
  ],
};

export default config;