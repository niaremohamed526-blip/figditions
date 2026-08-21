/**
 * WASM-free Shiki code-highlighter plugin for Streamdown.
 *
 * Replaces `@streamdown/code` (which imports the full `shiki` bundle) so the
 * Oniguruma WASM engine never enters the module graph. The WASM module breaks
 * the Vercel/Nitro build with:
 *   [unwasm] Failed to parse WASM module wasm/onig-*.wasm: magic header not detected
 *
 * This plugin implements the same `code-highlighter` interface using
 * `shiki/core` + the JavaScript RegExp engine — no WASM, lazy language/theme
 * chunks, same rendering result.
 */
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages, bundledLanguagesInfo } from "shiki/langs";
import { bundledThemes } from "shiki/themes";

interface ThemeInput {
  [key: string]: unknown;
}

interface HighlightResult {
  tokens: unknown[][];
  fg: string;
  bg: string;
  themeName?: string;
}

interface HighlightOptions {
  code: string;
  language: string;
  themes: [string | ThemeInput, string | ThemeInput];
}

export interface CodeHighlighterPlugin {
  name: "shiki";
  type: "code-highlighter";
  getSupportedLanguages: () => string[];
  getThemes: () => [string | ThemeInput, string | ThemeInput];
  supportsLanguage: (language: string) => boolean;
  highlight: (
    options: HighlightOptions,
    callback?: (result: HighlightResult) => void
  ) => HighlightResult | null;
}

const DEFAULT_THEMES: [string, string] = ["github-light", "github-dark"];

// The JS RegExp engine replaces the Oniguruma WASM engine entirely.
const jsEngine = createJavaScriptRegexEngine({ forgiving: true });

type Highlighter = Awaited<ReturnType<typeof createHighlighterCore>>;

// Alias → canonical language id (e.g. "ts" → "typescript")
const languageAliases: Record<string, string> = Object.fromEntries(
  bundledLanguagesInfo.flatMap((info) =>
    (info.aliases ?? []).map((alias) => [alias, info.id])
  )
);

const supportedLanguages = new Set<string>(Object.keys(bundledLanguages));

const normalizeLanguage = (language: string): string => {
  const trimmed = language.trim().toLowerCase();
  return languageAliases[trimmed] ?? trimmed;
};

const resolveTheme = (theme: string | ThemeInput): unknown => {
  if (typeof theme !== "string") {
    return theme;
  }
  const loader = (bundledThemes as Record<string, (() => unknown) | undefined>)[
    theme
  ];
  return loader ? loader() : theme;
};

// Highlighter cache (one per language + theme pair)
const highlighterCache = new Map<string, Promise<Highlighter>>();

const getHighlighter = (
  language: string,
  themes: [string | ThemeInput, string | ThemeInput]
): Promise<Highlighter> => {
  const themeName = (t: string | ThemeInput) =>
    typeof t === "string" ? t : String(t.name ?? "custom");
  const key = `${language}-${themeName(themes[0])}-${themeName(themes[1])}`;

  const cached = highlighterCache.get(key);
  if (cached) {
    return cached;
  }

  const langLoader = (
    bundledLanguages as Record<string, (() => unknown) | undefined>
  )[language];

  const highlighterPromise = createHighlighterCore({
    langs: langLoader ? [langLoader()] : [],
    themes: [resolveTheme(themes[0]), resolveTheme(themes[1])],
    engine: jsEngine,
  } as Parameters<typeof createHighlighterCore>[0]);

  highlighterCache.set(key, highlighterPromise);
  return highlighterPromise;
};

// Token + subscriber caches so re-renders are synchronous once highlighted
const tokensCache = new Map<string, HighlightResult>();
const subscribers = new Map<string, Set<(result: HighlightResult) => void>>();

const getCacheKey = (
  code: string,
  language: string,
  themes: [string | ThemeInput, string | ThemeInput]
): string => {
  const themeName = (t: string | ThemeInput) =>
    typeof t === "string" ? t : String(t.name ?? "custom");
  const start = code.slice(0, 100);
  const end = code.length > 100 ? code.slice(-100) : "";
  return `${language}:${themeName(themes[0])}:${themeName(themes[1])}:${code.length}:${start}:${end}`;
};

export const createMedmoCodePlugin = (): CodeHighlighterPlugin => ({
  name: "shiki",
  type: "code-highlighter",

  supportsLanguage: (language: string) =>
    supportedLanguages.has(normalizeLanguage(language)),

  getSupportedLanguages: () => Array.from(supportedLanguages),

  getThemes: () => DEFAULT_THEMES,

  highlight({ code, language, themes }, callback) {
    const languageId = normalizeLanguage(language);
    const cacheKey = getCacheKey(code, languageId, themes);

    const cached = tokensCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (callback) {
      if (!subscribers.has(cacheKey)) {
        subscribers.set(cacheKey, new Set());
      }
      subscribers.get(cacheKey)?.add(callback);
    }

    const langToLoad = supportedLanguages.has(languageId)
      ? languageId
      : "text";

    getHighlighter(langToLoad, themes)
      // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then)
      .then((highlighter) => {
        const loaded = highlighter.getLoadedLanguages();
        const langToUse = loaded.includes(languageId) ? languageId : "text";

        const result = highlighter.codeToTokens(code, {
          lang: langToUse,
          themes: {
            light:
              typeof themes[0] === "string"
                ? themes[0]
                : String(themes[0].name ?? "github-light"),
            dark:
              typeof themes[1] === "string"
                ? themes[1]
                : String(themes[1].name ?? "github-dark"),
          },
        }) as unknown as HighlightResult;

        tokensCache.set(cacheKey, result);

        const subs = subscribers.get(cacheKey);
        if (subs) {
          for (const sub of subs) {
            sub(result);
          }
          subscribers.delete(cacheKey);
        }
      })
      // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then), eslint-plugin-promise(prefer-await-to-callbacks)
      .catch((error) => {
        console.error("[MEDMO Code] Failed to highlight code:", error);
        subscribers.delete(cacheKey);
      });

    return null;
  },
});

/** Pre-configured plugin instance (drop-in replacement for `@streamdown/code`). */
export const medmoCodePlugin = createMedmoCodePlugin();
