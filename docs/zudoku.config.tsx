import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";
import { SubscribePage } from "./SubscribePage";

const config: ZudokuConfig = {
  site: {
    title: "Forest River Developer Portal",
    banner: {
      message: "🚧 Demo environment — not connected to production systems.",
      color: "caution",
      dismissible: true,
    },
  },

  authentication: {
    type: "auth0",
    domain: "dev-l3ayzqncrfw3ta50.us.auth0.com",
    clientId: "GgoZWZhD9XXpCJC771LkiKtnC3VRk0E9",
    audience: "https://forest-river-demo",
  },

  apis: {
    type: "file",
    input: "../config/routes.oas.json",
    path: "/api",
  },

  docs: {
    files: "/pages/**/*.{md,mdx}",
  },

  navigation: [
    {
      type: "category",
      label: "Documentation",
      icon: "book",
      items: [
        {
          type: "doc",
          file: "introduction",
          label: "Introduction",
        },
        {
          type: "doc",
          file: "quickstart",
          label: "Quick Start",
        },
        {
          type: "doc",
          file: "authentication",
          label: "Authentication",
        },
      ],
    },
    {
      type: "link",
      to: "/api",
      label: "API Reference",
      icon: "code",
    },
    // Plans are publicly visible — login is triggered on "Request access" click
    {
      type: "custom-page",
      path: "/subscribe",
      label: "Plans",
      icon: "credit-card",
      element: <SubscribePage view="plans" />,
      display: "always",
    },
    // My Subscriptions only shown when logged in
    {
      type: "custom-page",
      path: "/my-subscriptions",
      label: "My Subscriptions",
      icon: "key",
      element: <SubscribePage view="subscriptions" />,
      display: "always",
    },
  ],

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