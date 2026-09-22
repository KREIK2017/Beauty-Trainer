import { z } from "zod";
import { lineSchema } from "./schema";

export const learningAccessSchema = z
  .object({
    allMaterials: z.boolean(),
    brandIds: z.array(lineSchema.shape.id).max(500),
    lineIds: z.array(lineSchema.shape.id).max(2000),
  })
  .strict();
export type LearningAccess = z.infer<typeof learningAccessSchema>;
