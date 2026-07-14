import { describe, expect, it, vi } from "vitest";
import { PandaScoreApi } from "../src/api/pandascore.ts";

const TEAM = { acronym: "TS", id: 7, name: "Team Spirit" };
const ESPORTS_WORLD_CUP = { name: "Esports World Cup" };
const SERIES = {
  full_name: "2026",
  id: 10_728,
  league: ESPORTS_WORLD_CUP,
};
const MATCH = {
  begin_at: null,
  draw: false,
  match_type: "best_of",
  number_of_games: 3,
  opponents: [{ opponent: TEAM }, { opponent: null }],
  results: [],
  scheduled_at: "2026-07-13T10:00:00Z",
  serie: { full_name: "2026" },
  status: "not_started",
  streams_list: [],
  tournament: { name: "Survival" },
};

function createApi(
  responder: (request: Request) => Response | Promise<Response>
): { api: PandaScoreApi; requests: Request[] } {
  const requests: Request[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    return await responder(request);
  });
  return {
    api: new PandaScoreApi({ baseUrl: "https://pandascore.test/", fetch }),
    requests,
  };
}

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

describe("PandaScoreApi", () => {
  it("loads entities by id and keeps the token out of the URL", async () => {
    const { api, requests } = createApi((request) =>
      json(request.url.includes("/teams/") ? TEAM : SERIES)
    );

    await expect(api.getTeam(7, "private-token")).resolves.toEqual(TEAM);
    await expect(api.getSeries(10_728, "private-token")).resolves.toEqual(
      SERIES
    );
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/teams/7",
      "/series/10728",
    ]);
    expect(requests[0]?.headers.get("authorization")).toBe(
      "Bearer private-token"
    );
    expect(requests[0]?.url).not.toContain("private-token");
  });

  it("uses PandaScore substring search for teams", async () => {
    const { api, requests } = createApi(() =>
      json([TEAM], {
        headers: { "x-page": "1", "x-per-page": "6", "x-total": "1" },
      })
    );

    await expect(
      api.searchTeams("Spirit & Co", 1, 6, "token")
    ).resolves.toEqual({
      data: [TEAM],
      hasNext: false,
      page: 1,
      total: 1,
      totalPages: 1,
    });
    const teamUrl = new URL(requests[0]?.url ?? "");
    expect(teamUrl.searchParams.get("search[name]")).toBe("Spirit & Co");
    expect(teamUrl.searchParams.get("sort")).toBe("name,id");
    expect(teamUrl.searchParams.get("page[size]")).toBe("6");
  });

  it("searches whole series by their user-facing slug", async () => {
    const { api, requests } = createApi(() =>
      json([SERIES], {
        headers: { "x-page": "2", "x-per-page": "6", "x-total": "13" },
      })
    );

    await expect(
      api.searchSeries("Esports World Cup 2026", 2, 6, "token")
    ).resolves.toEqual({
      data: [SERIES],
      hasNext: true,
      page: 2,
      total: 13,
      totalPages: 3,
    });

    const seriesUrl = new URL(requests[0]?.url ?? "");
    expect(seriesUrl.pathname).toBe("/dota2/series");
    expect(seriesUrl.searchParams.get("search[slug]")).toBe(
      "esports-world-cup-2026"
    );
    expect(seriesUrl.searchParams.has("search[name]")).toBe(false);
    expect(seriesUrl.searchParams.get("sort")).toBe("-begin_at,-id");
    expect(seriesUrl.searchParams.get("page[number]")).toBe("2");
    expect(seriesUrl.searchParams.get("page[size]")).toBe("6");
  });

  it("does not turn punctuation-only searches into unfiltered API calls", async () => {
    const { api, requests } = createApi(() => json([SERIES]));
    await expect(api.searchSeries(" — ", 3, 6, "token")).resolves.toEqual({
      data: [],
      hasNext: false,
      page: 3,
    });
    expect(requests).toHaveLength(0);
  });

  it("deduplicates match loading behind one entity-aware method", async () => {
    const matches = Array.from({ length: 6 }, (_, index) => ({
      ...MATCH,
      id: index + 1,
    }));
    const { api, requests } = createApi(() => json(matches));

    await expect(
      api.getMatches("team", 7, "upcoming", 2, 6, "token")
    ).resolves.toMatchObject({ hasNext: true, page: 2 });
    await expect(
      api.getMatches("team", 7, "past", 0, 200, "token")
    ).resolves.toMatchObject({ hasNext: false, page: 1 });
    await api.getMatches("team", 7, "running", 1, 6, "token");
    await api.getMatches("series", 10_728, "upcoming", 3, 6, "token");
    await api.getMatches("series", 10_728, "past", 1, 6, "token");
    await api.getMatches("series", 10_728, "running", 1, 6, "token");

    const upcomingTeam = new URL(requests[0]?.url ?? "");
    expect(upcomingTeam.pathname).toBe("/dota2/matches/upcoming");
    expect(upcomingTeam.searchParams.get("filter[opponent_id]")).toBe("7");
    expect(upcomingTeam.searchParams.has("filter[status]")).toBe(false);
    expect(upcomingTeam.searchParams.get("sort")).toBe("scheduled_at,id");
    expect(upcomingTeam.searchParams.get("page[number]")).toBe("2");

    const pastTeam = new URL(requests[1]?.url ?? "");
    expect(pastTeam.pathname).toBe("/dota2/matches/past");
    expect(pastTeam.searchParams.get("filter[status]")).toBe("finished");
    expect(pastTeam.searchParams.get("sort")).toBe("-end_at,-id");
    expect(pastTeam.searchParams.get("page[number]")).toBe("1");
    expect(pastTeam.searchParams.get("page[size]")).toBe("100");

    const runningTeam = new URL(requests[2]?.url ?? "");
    expect(runningTeam.pathname).toBe("/dota2/matches/running");
    expect(runningTeam.searchParams.get("filter[opponent_id]")).toBe("7");
    expect(runningTeam.searchParams.get("sort")).toBe("begin_at,id");

    const upcomingSeries = new URL(requests[3]?.url ?? "");
    expect(upcomingSeries.pathname).toBe("/series/10728/matches/upcoming");
    expect(upcomingSeries.searchParams.has("filter[status]")).toBe(false);
    expect(upcomingSeries.searchParams.has("filter[opponent_id]")).toBe(false);

    const pastSeries = new URL(requests[4]?.url ?? "");
    expect(pastSeries.pathname).toBe("/series/10728/matches/past");
    expect(pastSeries.searchParams.get("filter[status]")).toBe("finished");

    const runningSeries = new URL(requests[5]?.url ?? "");
    expect(runningSeries.pathname).toBe("/series/10728/matches/running");
    expect(runningSeries.searchParams.get("sort")).toBe("begin_at,id");
  });

  it("uses pagination headers and a safe response-size fallback", async () => {
    const withHeaders = createApi(() =>
      json([MATCH], {
        headers: { "x-page": "2", "x-per-page": "6", "x-total": "13" },
      })
    );
    await expect(
      withHeaders.api.getMatches("team", 7, "upcoming", 2, 6, "token")
    ).resolves.toEqual({
      data: [MATCH],
      hasNext: true,
      page: 2,
      total: 13,
      totalPages: 3,
    });

    const withoutHeaders = createApi(() => json([MATCH]));
    await expect(
      withoutHeaders.api.getMatches("team", 7, "upcoming", 4, 1, "token")
    ).resolves.toEqual({ data: [MATCH], hasNext: true, page: 4 });
  });

  it("ignores malformed pagination headers", async () => {
    const { api } = createApi(() =>
      json([MATCH], {
        headers: { "x-page": "0", "x-per-page": "1.5", "x-total": "-2" },
      })
    );

    await expect(
      api.getMatches("team", 7, "upcoming", 4, 6, "token")
    ).resolves.toEqual({ data: [MATCH], hasNext: false, page: 4 });
  });

  it("filters matches without a single known participant", async () => {
    const unknown = {
      ...MATCH,
      id: 12,
      opponents: [{ opponent: null }, { opponent: null }],
    };
    const { api } = createApi(() => json([unknown, MATCH]));

    await expect(
      api.getMatches("series", 10_728, "upcoming", 1, 6, "token")
    ).resolves.toMatchObject({ data: [MATCH] });
  });

  it("keeps only finished matches in past results", async () => {
    const finished = { ...MATCH, status: "finished" };
    const canceled = { ...MATCH, status: "canceled" };
    const { api } = createApi(() => json([canceled, finished]));

    await expect(
      api.getMatches("team", 7, "past", 1, 6, "token")
    ).resolves.toMatchObject({ data: [finished] });
  });

  it("validates tokens without hiding upstream failures", async () => {
    const valid = createApi(() => json([TEAM]));
    await expect(valid.api.validateToken("token")).resolves.toBe(true);

    await Promise.all(
      [401, 403].map(async (status) => {
        const invalid = createApi(() => json({}, { status }));
        await expect(invalid.api.validateToken("token")).resolves.toBe(false);
      })
    );

    const unavailable = createApi(() => json({}, { status: 500 }));
    await expect(unavailable.api.validateToken("token")).rejects.toMatchObject({
      response: { status: 500 },
    });
  });

  it("rejects invalid PandaScore payloads", async () => {
    const { api } = createApi(() => json({ name: "missing id" }));
    await expect(api.getTeam(7, "token")).rejects.toThrow();

    const invalidScore = createApi(() =>
      json([{ ...MATCH, results: [{ score: 1.5, team_id: TEAM.id }] }])
    );
    await expect(
      invalidScore.api.getMatches("team", 7, "running", 1, 6, "token")
    ).rejects.toThrow();
  });

  it("keeps matches when PandaScore adds a new match type", async () => {
    const { api } = createApi(() =>
      json([{ ...MATCH, match_type: "future_format" }])
    );

    await expect(
      api.getMatches("team", 7, "upcoming", 1, 6, "token")
    ).resolves.toMatchObject({
      data: [{ match_type: "unknown" }],
    });
  });
});
