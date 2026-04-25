import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";
import { SubscribePage } from "./SubscribePage";
import { AdminPage } from "./AdminPage";

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
      // Serve introduction.md at root so / doesn't 404
      type: "doc",
      file: "introduction",
      path: "/",
      label: "Home",
      display: "hide",
    },
    {
      type: "category",
      label: "Documentation",
      icon: "book",
      items: [
        { type: "doc", file: "introduction", label: "Introduction" },
        { type: "doc", file: "quickstart", label: "Quick Start" },
        { type: "doc", file: "authentication", label: "Authentication" },
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
        console.log("auth.profile", JSON.stringify(profile));
        const roles: string[] = profile?.roles ?? profile?.["https://forest-river-demo/roles"] ?? [];
        console.log("resolved roles", roles);
        return roles.includes("api-admin");
      },
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