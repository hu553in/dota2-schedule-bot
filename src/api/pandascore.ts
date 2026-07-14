import ky, { isHTTPError, type KyInstance } from "ky";
import { z } from "zod";
import type { Page } from "../pagination.ts";
import {
  type Match,
  matchSchema,
  type Series,
  seriesSchema,
  type Team,
  teamSchema,
} from "./schemas.ts";

const API_URL = "https://api.pandascore.co/";
const MAX_PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 3500;
const TOTAL_TIMEOUT_MS = 5000;
const INTEGER_HEADER_PATTERN = /^\d+$/u;

type QueryValue = boolean | number | string;

interface RequestOptions {
  filter?: Record<string, QueryValue>;
  page?: number;
  perPage: number;
  search?: Record<string, string>;
  sort?: string;
  token: string;
}

export type EntityType = "series" | "team";
export type MatchDirection = "past" | "running" | "upcoming";

const MATCH_SORT: Record<MatchDirection, string> = {
  past: "-end_at,-id",
  running: "begin_at,id",
  upcoming: "scheduled_at,id",
};

export interface PandaScoreApiOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

function pageSize(value: number): number {
  return Math.min(Math.max(Math.trunc(value), 1), MAX_PAGE_SIZE);
}

function integerHeader(value: null | string, minimum: number): null | number {
  if (value === null || !INTEGER_HEADER_PATTERN.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : null;
}

function slugSearchTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addNestedParams(
  params: URLSearchParams,
  name: string,
  values?: Record<string, QueryValue>
): void {
  for (const [key, value] of Object.entries(values ?? {})) {
    params.set(`${name}[${key}]`, String(value));
  }
}

function collectionParams(
  options: RequestOptions,
  page: number,
  perPage: number
): URLSearchParams {
  const params = new URLSearchParams({
    "page[number]": String(page),
    "page[size]": String(perPage),
  });
  addNestedParams(params, "filter", options.filter);
  addNestedParams(params, "search", options.search);
  if (options.sort) {
    params.set("sort", options.sort);
  }
  return params;
}

export class PandaScoreApi {
  readonly #http: KyInstance;

  constructor(options: PandaScoreApiOptions = {}) {
    this.#http = ky.create({
      prefix: options.baseUrl ?? API_URL,
      retry: {
        jitter: true,
        limit: 1,
        methods: ["get"],
        retryOnTimeout: true,
      },
      timeout: REQUEST_TIMEOUT_MS,
      totalTimeout: TOTAL_TIMEOUT_MS,
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  }

  async getTeam(id: number, token: string): Promise<Team> {
    return await this.#request(`teams/${id}`, token, teamSchema);
  }

  async getSeries(id: number, token: string): Promise<Series> {
    return await this.#request(`series/${id}`, token, seriesSchema);
  }

  async searchTeams(
    searchTerm: string,
    page: number,
    perPage: number,
    token: string
  ): Promise<Page<Team>> {
    return await this.#requestCollection(
      "dota2/teams",
      {
        page,
        perPage,
        search: { name: searchTerm },
        sort: "name,id",
        token,
      },
      teamSchema
    );
  }

  async searchSeries(
    searchTerm: string,
    page: number,
    perPage: number,
    token: string
  ): Promise<Page<Series>> {
    const slug = slugSearchTerm(searchTerm);
    if (!slug) {
      return {
        data: [],
        hasNext: false,
        page: Math.max(Math.trunc(page), 1),
      };
    }
    return await this.#requestCollection(
      "dota2/series",
      {
        page,
        perPage,
        search: { slug },
        sort: "-begin_at,-id",
        token,
      },
      seriesSchema
    );
  }

  async getMatches(
    type: EntityType,
    id: number,
    direction: MatchDirection,
    page: number,
    perPage: number,
    token: string
  ): Promise<Page<Match>> {
    const path =
      type === "team"
        ? `dota2/matches/${direction}`
        : `series/${id}/matches/${direction}`;
    const entityFilter = {
      ...(type === "team" ? { opponent_id: id } : {}),
      ...(direction === "past" ? { status: "finished" } : {}),
    };
    const matches = await this.#requestCollection(
      path,
      {
        filter: entityFilter,
        page,
        perPage,
        sort: MATCH_SORT[direction],
        token,
      },
      matchSchema
    );
    return {
      ...matches,
      data: matches.data.filter(
        (match) =>
          match.opponents.some((opponent) => opponent.opponent) &&
          (direction !== "past" || match.status === "finished")
      ),
    };
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      await this.#requestCollection(
        "dota2/teams",
        { perPage: 1, token },
        teamSchema
      );
      return true;
    } catch (error) {
      if (
        isHTTPError(error) &&
        (error.response.status === 401 || error.response.status === 403)
      ) {
        return false;
      }
      throw error;
    }
  }

  #headers(token: string): Record<string, string> {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async #request<T>(
    path: string,
    token: string,
    schema: z.ZodType<T>
  ): Promise<T> {
    const response = await this.#http.get(path, {
      headers: this.#headers(token),
    });
    return schema.parse(await response.json());
  }

  async #requestCollection<T>(
    path: string,
    options: RequestOptions,
    schema: z.ZodType<T>
  ): Promise<Page<T>> {
    const requestedPage = Math.max(Math.trunc(options.page ?? 1), 1);
    const requestedPageSize = pageSize(options.perPage);
    const response = await this.#http.get(path, {
      headers: this.#headers(options.token),
      searchParams: collectionParams(options, requestedPage, requestedPageSize),
    });
    const data = z.array(schema).parse(await response.json());
    const page =
      integerHeader(response.headers.get("x-page"), 1) ?? requestedPage;
    const perPage =
      integerHeader(response.headers.get("x-per-page"), 1) ?? requestedPageSize;
    const total = integerHeader(response.headers.get("x-total"), 0);
    const hasNext =
      total === null ? data.length === perPage : page * perPage < total;

    return total === null
      ? { data, hasNext, page }
      : {
          data,
          hasNext,
          page,
          total,
          totalPages: Math.max(Math.ceil(total / perPage), 1),
        };
  }
}
