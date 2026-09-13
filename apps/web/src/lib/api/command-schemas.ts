import { caseRecordSchema } from "@rectify/core";
import { z } from "zod";

export const openCaseResponseSchema = z.object({ case: caseRecordSchema });

export const queuedJobResponseSchema = z.object({ jobId: z.string().min(1) });
