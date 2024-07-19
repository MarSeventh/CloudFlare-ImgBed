import type { Toucan } from "toucan-js";
import type { Options } from "toucan-js/dist/types";

export type PluginArgs = Omit<Options, "context">;

export type PluginData = { sentry: Toucan };

export default function (args: PluginArgs): PagesFunction;
