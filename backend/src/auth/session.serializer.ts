import { Injectable } from "@nestjs/common";
import { PassportSerializer } from "@nestjs/passport";
import { Staff } from "../database/models/staff.model.js";
import { AuthService } from "./auth.service.js";

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly auth: AuthService) { super(); }

  serializeUser(user: any, done: (error: Error | null, key?: string) => void) {
    done(null, `${user instanceof Staff ? "staff" : "student"}:${user.id}`);
  }

  async deserializeUser(key: string, done: (error: Error | null, user?: any) => void) {
    try {
      const user = await this.auth.deserialize(key);
      done(null, user || false);
    } catch (error) {
      done(error as Error);
    }
  }
}
