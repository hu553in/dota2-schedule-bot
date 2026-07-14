import { StatelessQuestion } from "@grammyjs/stateless-question";
import { Composer, type MiddlewareFn } from "grammy";
import type { EntityType } from "../api/pandascore.ts";
import type { BotContext } from "./context.ts";
import { privateCommandOnly } from "./runtime.ts";

type InputMode = EntityType | "timezone" | "token";
type InputHandler = (context: BotContext, rawText: string) => Promise<void>;

export interface InputRouter {
  handle: (mode: InputMode, handler: InputHandler) => void;
  middleware: () => MiddlewareFn<BotContext>;
  prompt: (
    context: BotContext,
    mode: InputMode,
    message?: string
  ) => Promise<void>;
}

const INPUT_MODES: InputMode[] = ["team", "series", "timezone", "token"];

interface InputBot {
  id: number;
  username: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function createInputRouter(bot: InputBot): InputRouter {
  const handlers = new Map<InputMode, InputHandler>();

  function createQuestion(mode: InputMode): StatelessQuestion<BotContext> {
    return new StatelessQuestion<BotContext>(
      `input:${mode}`,
      async (context) => {
        if (context.message.reply_to_message.from?.id !== bot.id) {
          return;
        }
        const handler = handlers.get(mode);
        if (!handler) {
          throw new Error(`No input handler registered for ${mode}`);
        }
        const text = "text" in context.message ? context.message.text : null;
        if (
          context.message.chat.type !== "private" &&
          (mode !== "token" || text === null)
        ) {
          await privateCommandOnly(context, bot.username);
          return;
        }
        if (text === null) {
          await context.reply(context.t("input.invalidKind"));
          await prompt(context, mode);
          return;
        }
        await handler(context, text);
      }
    );
  }

  const questions: Record<InputMode, StatelessQuestion<BotContext>> = {
    series: createQuestion("series"),
    team: createQuestion("team"),
    timezone: createQuestion("timezone"),
    token: createQuestion("token"),
  };

  async function prompt(
    context: BotContext,
    mode: InputMode,
    message?: string
  ): Promise<void> {
    const question = questions[mode];
    const text = `${escapeHtml(message ?? context.t(`input.prompt.${mode}`))}${question.messageSuffixHTML()}`;
    await context.reply(text, {
      parse_mode: "HTML",
      reply_markup: {
        force_reply: true,
        input_field_placeholder: context.t(`input.placeholder.${mode}`),
        selective: true,
      },
    });
  }

  return {
    handle(mode, handler) {
      if (handlers.has(mode)) {
        throw new Error(`Input handler already registered for ${mode}`);
      }
      handlers.set(mode, handler);
    },
    middleware() {
      const composer = new Composer<BotContext>();
      for (const mode of INPUT_MODES) {
        composer.use(questions[mode].middleware());
      }
      return composer.middleware();
    },
    prompt,
  };
}
