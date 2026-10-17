import { DurableObject } from "cloudflare:workers";
/** Independent incident latch: a failed D1 write must not require a successful D1 write to preserve links. */
export class ExpiryGuard extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method === "POST" && path === "/hold")
      await this.ctx.storage.put("hold", true);
    else if (request.method === "POST" && path === "/clear")
      await this.ctx.storage.put("hold", false);
    return Response.json({
      hold: (await this.ctx.storage.get<boolean>("hold")) ?? false,
    });
  }
}
