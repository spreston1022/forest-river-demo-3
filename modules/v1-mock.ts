import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

const DEPRECATION_HEADERS = {
  "Deprecation": "Thu, 15 Jan 2026 00:00:00 GMT",
  "Sunset": "Wed, 01 Jul 2026 23:59:59 GMT",
  "Link": '<https://forest-river-demo-main-fb06bf1.zuplo.site/api>; rel="successor-version"',
  "Content-Type": "application/json",
};

const MOCK: Record<string, unknown> = {
  "/v1/vehicles": [
    { id: "veh-001", sku: "RW-2892RB-2025", make: "Forest River", brand: "Rockwood", model: "Ultra Lite 2892RB", year: 2025, type: "travel-trailer", msrp: 42999, dealerCode: "FR-1234", available: true },
    { id: "veh-002", sku: "CWP-365SUITE-2025", make: "Forest River", brand: "Cherokee", model: "Wolf Pack 365SUITE16", year: 2025, type: "fifth-wheel", msrp: 89995, dealerCode: "FR-5678", available: true },
    { id: "veh-003", sku: "WP-25WP-2024", make: "Forest River", brand: "Work and Play", model: "25WP", year: 2024, type: "toy-hauler", msrp: 38500, dealerCode: "FR-9012", available: false },
  ],
  "/v1/inventory": [
    { inventoryId: "inv-78234", sku: "RW-2892RB-2025", brand: "Rockwood", model: "Ultra Lite 2892RB", year: 2025, dealerCode: "FR-1234", status: "on-lot", msrp: 42999, salePrice: 39995 },
    { inventoryId: "inv-78235", sku: "BX-45A-2025", brand: "Berkshire", model: "XLT 45A", year: 2025, dealerCode: "FR-1234", status: "in-transit", msrp: 289995, salePrice: 275000 },
  ],
  "/v1/orders": [
    { orderId: "ord-2026-00891", status: "in-production", sku: "RW-2892RB-2025", dealerCode: "FR-1234", salePrice: 39995, createdAt: "2026-04-30T14:23:11Z" },
  ],
};

export default async function (request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);
  const data = MOCK[url.pathname] ?? [];
  return new Response(JSON.stringify(data), { status: 200, headers: DEPRECATION_HEADERS });
}
