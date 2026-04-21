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
    type: "openid",
    // TODO: Replace with your OIDC client ID
    clientId: "TODO_YOUR_CLIENT_ID",
    // TODO: Replace with your OIDC issuer URL
    issuer: "TODO_YOUR_ISSUER_URL",
  },

  apis: {
    type: "url",
    input: "https://forest-river-demo-main-fb06bf1.zuplo.app/openapi",
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
    {
      type: "custom-page",
      path: "/subscribe",
      label: "Plans",
      icon: "credit-card",
      element: <SubscribePage view="plans" />,
      display: "auth",
    },
    {
      type: "custom-page",
      path: "/my-subscriptions",
      label: "My Subscriptions",
      icon: "key",
      element: <SubscribePage view="subscriptions" />,
      display: "auth",
    },
  ],

  protectedRoutes: ["/subscribe", "/my-subscriptions"],

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
