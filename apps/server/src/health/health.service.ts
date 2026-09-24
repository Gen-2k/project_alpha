import { Injectable } from "@nestjs/common";

export interface HealthStatus {
  status: "ok";
  uptimeSeconds: number;
  version: string;
}

@Injectable()
export class HealthService {
  status(): HealthStatus {
    return {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      version: "0.0.0",
    };
  }

  echo(message: string): { echo: string } {
    return { echo: message };
  }
}
