declare module "oidc-provider" {
  import type { Server } from "node:http";

  export class Provider {
    constructor(issuer: string, configuration: unknown);
    listen(port: number, hostname: string, callback?: () => void): Server;
  }
}
