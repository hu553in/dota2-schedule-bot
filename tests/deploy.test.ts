import { describe, expect, it } from "vitest";

import {
  selectDeploymentSecrets,
  workerDeployArguments,
  workerUrlFromDeployOutput,
} from "../scripts/deployment.ts";
import type { DeploymentVariables } from "../scripts/deployment.ts";

const VALID_VARIABLES = {
  BOT_TOKEN: "123456789:local_bot_token_123456789012345",
  PS_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  WEBHOOK_SECRET: "local_webhook_secret_1234567890_ab",
} satisfies DeploymentVariables;

describe("deployment", () => {
  it("extracts and normalizes the deployed workers.dev URL", () => {
    expect(
      workerUrlFromDeployOutput(
        [
          JSON.stringify({ message: "Uploaded d2-schedule-bot", type: "log" }),
          JSON.stringify({
            targets: [
              "schedule: 0 * * * *",
              "https://d2-schedule-bot.example.workers.dev/",
            ],
            type: "deploy",
            version: 1,
          }),
        ].join("\n")
      )
    ).toBe("https://d2-schedule-bot.example.workers.dev");
  });

  it("fails when Wrangler does not report a workers.dev URL", () => {
    expect(() =>
      workerUrlFromDeployOutput(
        JSON.stringify({
          targets: ["https://example.com"],
          type: "deploy",
          version: 1,
        })
      )
    ).toThrow("Wrangler did not report a workers.dev deployment URL");
  });

  it("fails when Wrangler writes malformed deployment output", () => {
    expect(() => workerUrlFromDeployOutput("not-json")).toThrow(
      "Wrangler wrote invalid deployment output"
    );
  });

  it("keeps local runtime secrets atomic and uses the environment in CI", () => {
    const environment = {
      BOT_TOKEN: "987654321:environment_bot_token_1234567890",
      PS_MASTER_KEY: undefined,
      WEBHOOK_SECRET: "environment_webhook_secret_123456789",
    } satisfies DeploymentVariables;
    expect(selectDeploymentSecrets(VALID_VARIABLES, environment)).toStrictEqual(
      {
        botToken: VALID_VARIABLES.BOT_TOKEN,
        useLocalSecrets: true,
        webhookSecret: VALID_VARIABLES.WEBHOOK_SECRET,
      }
    );
    expect(selectDeploymentSecrets(null, environment)).toStrictEqual({
      botToken: environment.BOT_TOKEN,
      useLocalSecrets: false,
      webhookSecret: environment.WEBHOOK_SECRET,
    });
  });

  it.each([
    [{ ...VALID_VARIABLES, BOT_TOKEN: "invalid" }, "BOT_TOKEN"],
    [{ ...VALID_VARIABLES, WEBHOOK_SECRET: "short" }, "WEBHOOK_SECRET"],
    [{ ...VALID_VARIABLES, PS_MASTER_KEY: "invalid" }, "PS_MASTER_KEY"],
  ])("rejects invalid local deployment variables %#", (variables, name) => {
    expect(() => selectDeploymentSecrets(variables, VALID_VARIABLES)).toThrow(
      `${name} is missing or invalid in .dev.vars`
    );
  });

  it("builds a secret-free Wrangler argument list", () => {
    const bot = { first_name: "Dota Bot", username: "dota_bot" };
    expect(workerDeployArguments(bot, null)).toStrictEqual([
      "deploy",
      "--var",
      "BOT_NAME:Dota Bot",
      "--var",
      "BOT_USERNAME:dota_bot",
    ]);
    expect(workerDeployArguments(bot, ".dev.vars")).toStrictEqual([
      ...workerDeployArguments(bot, null),
      "--secrets-file",
      ".dev.vars",
    ]);
  });
});
