import { z } from "zod";

function knownOrUnknown<T extends string>(schema: z.ZodType<T>) {
  return z.string().transform((value): T | "unknown" => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : "unknown";
  });
}

export const teamSchema = z.object({
  acronym: z.string().nullish(),
  id: z.number().int().positive(),
  name: z.string(),
});

const leagueSchema = z.object({
  name: z.string(),
});

export const seriesSchema = z.object({
  full_name: z.string(),
  id: z.number().int().positive(),
  league: leagueSchema,
});

const tournamentSchema = z.object({
  name: z.string(),
});

const seriesReferenceSchema = z.object({
  full_name: z.string(),
});

const matchStatusSchema = knownOrUnknown(
  z.enum(["not_started", "running", "finished", "canceled", "postponed"])
);

const opponentSchema = z.object({
  opponent: teamSchema.nullable(),
});

const matchResultSchema = z.object({
  score: z.number().int().nonnegative(),
  team_id: z.number().int().positive().nullish(),
});

const matchTypeSchema = knownOrUnknown(
  z.enum([
    "all_games_played",
    "best_of",
    "custom",
    "first_to",
    "ow_best_of",
    "red_bull_home_ground",
  ])
);

const streamSchema = z.object({
  language: z.string(),
  main: z.boolean(),
  official: z.boolean(),
  raw_url: z.httpUrl(),
});

export const matchSchema = z.object({
  begin_at: z.string().nullish(),
  draw: z.boolean(),
  league: leagueSchema.nullish(),
  match_type: matchTypeSchema,
  number_of_games: z.number().int().nonnegative(),
  opponents: z.array(opponentSchema).default([]),
  results: z.array(matchResultSchema).default([]),
  scheduled_at: z.string().nullish(),
  serie: seriesReferenceSchema.nullish(),
  status: matchStatusSchema,
  streams_list: z.array(streamSchema),
  tournament: tournamentSchema.nullish(),
});

export type Match = z.infer<typeof matchSchema>;
export type Series = z.infer<typeof seriesSchema>;
export type Team = z.infer<typeof teamSchema>;
