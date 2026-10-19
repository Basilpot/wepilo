import type { Env } from "@/env";
import type { AppVariables } from "@/middleware/context";

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
