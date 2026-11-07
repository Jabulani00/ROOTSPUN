export const dynamic = "force-static";

/** Minimal OpenAPI description of the public API (RS-404). */
const spec = {
  openapi: "3.1.0",
  info: { title: "Rootspun Public API", version: "1.0.0" },
  servers: [{ url: "/api/public/v1" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
  },
  paths: {
    "/clients": {
      get: {
        summary: "List clients",
        description: "Requires scope clients:read",
        responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
      },
    },
    "/scores": {
      get: {
        summary: "Daily visibility scores",
        description: "Requires scope scores:read",
        parameters: [
          { name: "clientId", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
      },
    },
  },
};

export function GET(): Response {
  return Response.json(spec);
}
