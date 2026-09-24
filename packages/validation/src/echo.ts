import { z } from "zod";

// Shared echo contract: used by apps/server to validate the request body
// today, and usable by any future frontend form as-is tomorrow. One schema,
// both sides — this is why Zod lives here instead of class-validator
// decorators, which only work on the backend.
export const echoSchema = z.object({
  message: z.string().min(1).max(280),
});

export type EchoDto = z.infer<typeof echoSchema>;
