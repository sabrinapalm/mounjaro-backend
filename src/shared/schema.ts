import { z } from "zod";

export const sideEffectSchema = z.enum([
  "nausea",
  "fatigue",
  "headache",
  "constipation",
  "diarrhea",
  "stomach_pain",
  "injection_site_reaction",
  "reduced_appetite",
  "heartburn",
  "other",
]);
