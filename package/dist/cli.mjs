#! /usr/bin/env node
import {
  HUB_URL,
  createBranch,
  createRepo,
  deleteBranch,
  deleteRepo,
  repoExists,
  typedEntries,
  uploadFilesWithProgress
} from "./chunk-ZRFO5QHC.mjs";
import "./chunk-GAR7ORU2.mjs";

// cli.ts
import { parseArgs } from "util";
import { pathToFileURL } from "url";
import { stat } from "fs/promises";
import { basename, join } from "path";

// package.json
var version = "2.7.1";

// cli.ts
var UploadProgressManager = class {
  multibar = null;
  fileBars = /* @__PURE__ */ new Map();
  isQuiet;
  cliProgressAvailable = false;
  constructor(isQuiet = false) {
    this.isQuiet = isQuiet;
  }
  async initialize() {
    if (this.isQuiet)
      return;
    try {
      const cliProgress = await import("./cli-progress-A335VRBC.mjs");
      this.cliProgressAvailable = true;
      this.multibar = new cliProgress.MultiBar(
        {
          clearOnComplete: false,
          hideCursor: true,
          format: " {bar} | {filename} | {percentage}% | {state}",
          barCompleteChar: "\u2588",
          barIncompleteChar: "\u2591"
        },
        cliProgress.Presets.shades_grey
      );
    } catch (error) {
      this.cliProgressAvailable = false;
    }
  }
  handleEvent(event) {
    if (this.isQuiet)
      return;
    if (event.event === "phase") {
      this.logPhase(event.phase);
    } else if (event.event === "fileProgress") {
      this.updateFileProgress(event.path, event.progress, event.state);
    }
  }
  logPhase(phase) {
    if (this.isQuiet)
      return;
    const phaseMessages = {
      preuploading: "\u{1F4CB} Preparing files for upload...",
      uploadingLargeFiles: "\u2B06\uFE0F  Uploading files...",
      committing: "\u2728 Finalizing commit..."
    };
    console.log(`
${phaseMessages[phase] || phase}`);
  }
  updateFileProgress(path, progress, state) {
    if (this.isQuiet)
      return;
    if (this.cliProgressAvailable && this.multibar) {
      let bar = this.fileBars.get(path);
      if (!bar) {
        bar = this.multibar.create(100, 0, {
          filename: this.truncateFilename(path, 100),
          state
        });
        this.fileBars.set(path, bar);
      }
      if (progress >= 1) {
        bar.update(100, { state: state === "hashing" ? "\u2713 hashed" : "\u2713 uploaded" });
      } else {
        const percentage = Math.round(progress * 100);
        bar.update(percentage, { state });
      }
    } else {
      const percentage = Math.round(progress * 100);
      const truncatedPath = this.truncateFilename(path, 100);
      if (progress >= 1) {
        const statusIcon = state === "hashing" ? "\u2713 hashed" : "\u2713 uploaded";
        console.log(`${statusIcon}: ${truncatedPath}`);
      } else if (percentage % 25 === 0) {
        console.log(`${state}: ${truncatedPath} (${percentage}%)`);
      }
    }
  }
  truncateFilename(filename, maxLength) {
    if (filename.length <= maxLength)
      return filename;
    return "..." + filename.slice(-(maxLength - 3));
  }
  stop() {
    if (!this.isQuiet && this.cliProgressAvailable && this.multibar) {
      this.multibar.stop();
    }
  }
};
var commands = {
  upload: {
    description: "Upload a folder to a repo on the Hub",
    args: [
      {
        name: "repo-name",
        description: "The name of the repo to upload to",
        positional: true,
        required: true
      },
      {
        name: "local-folder",
        description: "The local folder to upload. Defaults to the current working directory",
        positional: true,
        default: () => process.cwd()
      },
      {
        name: "path-in-repo",
        description: "The path in the repo to upload the folder to. Defaults to the root of the repo",
        positional: true,
        default: "."
      },
      {
        name: "quiet",
        short: "q",
        description: "Suppress all output",
        boolean: true
      },
      {
        name: "repo-type",
        enum: ["dataset", "model", "space"],
        description: "The type of repo to upload to. Defaults to model. You can also prefix the repo name with the type, e.g. datasets/username/repo-name"
      },
      {
        name: "revision",
        description: "The revision to upload to. Defaults to the main branch",
        default: "main"
      },
      {
        name: "commit-message",
        description: "The commit message to use. Defaults to 'Upload files using @huggingface/hub'",
        default: "Upload files using @huggingface/hub"
      },
      {
        name: "private",
        description: "If creating a new repo, make it private",
        boolean: true
      },
      {
        name: "token",
        description: "The access token to use for authentication. If not provided, the HF_TOKEN environment variable will be used.",
        default: process.env.HF_TOKEN
      }
    ]
  },
  branch: {
    description: "Manage repository branches",
    subcommands: {
      create: {
        description: "Create a new branch in a repo, or update an existing one",
        args: [
          {
            name: "repo-name",
            description: "The name of the repo to create the branch in",
            positional: true,
            required: true
          },
          {
            name: "branch",
            description: "The name of the branch to create",
            positional: true,
            required: true
          },
          {
            name: "repo-type",
            enum: ["dataset", "model", "space"],
            description: "The type of the repo to create the branch into. Defaults to model. You can also prefix the repo name with the type, e.g. datasets/username/repo-name"
          },
          {
            name: "revision",
            description: "The revision to create the branch from. Defaults to the main branch, or existing branch if it exists."
          },
          {
            name: "empty",
            boolean: true,
            description: "Create an empty branch. This will erase all previous commits on the branch if it exists."
          },
          {
            name: "force",
            short: "f",
            boolean: true,
            description: "Overwrite the branch if it already exists. Otherwise, throws an error if the branch already exists. No-ops if no revision is provided and the branch exists."
          },
          {
            name: "token",
            description: "The access token to use for authentication. If not provided, the HF_TOKEN environment variable will be used.",
            default: process.env.HF_TOKEN
          }
        ]
      },
      delete: {
        description: "Delete a branch in a repo",
        args: [
          {
            name: "repo-name",
            description: "The name of the repo to delete the branch from",
            positional: true,
            required: true
          },
          {
            name: "branch",
            description: "The name of the branch to delete",
            positional: true,
            required: true
          },
          {
            name: "repo-type",
            enum: ["dataset", "model", "space"],
            description: "The type of repo to delete the branch from. Defaults to model. You can also prefix the repo name with the type, e.g. datasets/username/repo-name"
          },
          {
            name: "token",
            description: "The access token to use for authentication. If not provided, the HF_TOKEN environment variable will be used.",
            default: process.env.HF_TOKEN
          }
        ]
      }
    }
  },
  repo: {
    description: "Manage repositories on the Hub",
    subcommands: {
      delete: {
        description: "Delete a repository from the Hub",
        args: [
          {
            name: "repo-name",
            description: "The name of the repo to delete. You can also prefix the repo name with the type, e.g. datasets/username/repo-name",
            positional: true,
            required: true
          },
          {
            name: "repo-type",
            enum: ["dataset", "model", "space"],
            description: "The type of the repo to delete. Defaults to model. You can also prefix the repo name with the type, e.g. datasets/username/repo-name"
          },
          {
            name: "token",
            description: "The access token to use for authentication. If not provided, the HF_TOKEN environment variable will be used.",
            default: process.env.HF_TOKEN
          }
        ]
      }
    }
  },
  version: {
    description: "Print the version of the CLI",
    args: []
  }
};
var mainCommandName = process.argv[2];
var subCommandName;
var cliArgs;
if (mainCommandName && mainCommandName in commands && commands[mainCommandName] && "subcommands" in commands[mainCommandName]) {
  subCommandName = process.argv[3];
  cliArgs = process.argv.slice(4);
} else {
  cliArgs = process.argv.slice(3);
}
async function run() {
  switch (mainCommandName) {
    case void 0:
    case "--help":
    case "help": {
      const helpArgs = mainCommandName === "help" ? process.argv.slice(3) : [];
      if (helpArgs.length > 0) {
        const cmdName = helpArgs[0];
        if (cmdName && commands[cmdName]) {
          const cmdDef = commands[cmdName];
          if ("subcommands" in cmdDef) {
            if (helpArgs.length > 1) {
              const subCmdName = helpArgs[1];
              if (subCmdName in cmdDef.subcommands && cmdDef.subcommands[subCmdName]) {
                console.log(detailedUsageForSubcommand(cmdName, subCmdName));
                break;
              } else {
                console.error(`Error: Unknown subcommand '${subCmdName}' for command '${cmdName}'.`);
                console.log(listSubcommands(cmdName, cmdDef));
                process.exitCode = 1;
                break;
              }
            } else {
              console.log(listSubcommands(cmdName, cmdDef));
              break;
            }
          } else {
            console.log(detailedUsageForCommand(cmdName));
            break;
          }
        } else {
          console.error(`Error: Unknown command '${cmdName}' for help.`);
          process.exitCode = 1;
        }
      } else {
        console.log(
          `Hugging Face CLI Tools (hfjs)

Available commands:

` + typedEntries(commands).map(([name, def]) => `  ${usage(name)}: ${def.description}`).join("\n")
        );
        console.log("\nTo get help on a specific command, run `hfjs help <command>` or `hfjs <command> --help`");
        console.log(
          "For commands with subcommands (like 'branch'), run `hfjs help <command> <subcommand>` or `hfjs <command> <subcommand> --help`"
        );
        if (mainCommandName === void 0) {
          process.exitCode = 1;
        }
      }
      break;
    }
    case "upload": {
      const cmdDef = commands.upload;
      if (cliArgs[0] === "--help" || cliArgs[0] === "-h") {
        console.log(detailedUsageForCommand("upload"));
        break;
      }
      const parsedArgs = advParseArgs(cliArgs, cmdDef.args, "upload");
      const {
        repoName,
        localFolder,
        repoType,
        revision,
        token,
        quiet,
        commitMessage,
        pathInRepo,
        private: isPrivate
      } = parsedArgs;
      const repoId = repoType ? { type: repoType, name: repoName } : repoName;
      if (!await repoExists({ repo: repoId, revision, accessToken: token, hubUrl: process.env.HF_ENDPOINT ?? HUB_URL })) {
        if (!quiet) {
          console.log(`Repo ${repoName} does not exist. Creating it...`);
        }
        await createRepo({
          repo: repoId,
          accessToken: token,
          private: !!isPrivate,
          hubUrl: process.env.HF_ENDPOINT ?? HUB_URL
        });
      }
      const isFile = (await stat(localFolder)).isFile();
      const files = isFile ? [
        {
          content: pathToFileURL(localFolder),
          path: join(pathInRepo, `${basename(localFolder)}`).replace(/^[.]?\//, "")
        }
      ] : [{ content: pathToFileURL(localFolder), path: pathInRepo.replace(/^[.]?\//, "") }];
      const progressManager = new UploadProgressManager(!!quiet);
      await progressManager.initialize();
      try {
        for await (const event of uploadFilesWithProgress({
          repo: repoId,
          files,
          branch: revision,
          accessToken: token,
          commitTitle: commitMessage?.trim().split("\n")[0],
          commitDescription: commitMessage?.trim().split("\n").slice(1).join("\n").trim(),
          hubUrl: process.env.HF_ENDPOINT ?? HUB_URL,
          useXet: true
        })) {
          progressManager.handleEvent(event);
        }
        if (!quiet) {
          console.log("\n\u2705 Upload completed successfully!");
        }
      } catch (error) {
        progressManager.stop();
        throw error;
      } finally {
        progressManager.stop();
      }
      break;
    }
    case "branch": {
      const branchCommandGroup = commands.branch;
      const currentSubCommandName = subCommandName;
      if (cliArgs[0] === "--help" || cliArgs[0] === "-h") {
        if (currentSubCommandName && branchCommandGroup.subcommands[currentSubCommandName]) {
          console.log(detailedUsageForSubcommand("branch", currentSubCommandName));
        } else {
          console.log(listSubcommands("branch", branchCommandGroup));
        }
        break;
      }
      if (!currentSubCommandName || !branchCommandGroup.subcommands[currentSubCommandName]) {
        console.error(`Error: Missing or invalid subcommand for 'branch'.`);
        console.log(listSubcommands("branch", branchCommandGroup));
        process.exitCode = 1;
        break;
      }
      const subCmdDef = branchCommandGroup.subcommands[currentSubCommandName];
      switch (currentSubCommandName) {
        case "create": {
          const parsedArgs = advParseArgs(cliArgs, subCmdDef.args, "branch create");
          const { repoName, branch, revision, empty, repoType, token, force } = parsedArgs;
          await createBranch({
            repo: repoType ? { type: repoType, name: repoName } : repoName,
            branch,
            accessToken: token,
            revision,
            empty: empty ?? void 0,
            overwrite: force ?? void 0,
            hubUrl: process.env.HF_ENDPOINT ?? HUB_URL
          });
          console.log(`Branch '${branch}' created successfully in repo '${repoName}'.`);
          break;
        }
        case "delete": {
          const parsedArgs = advParseArgs(cliArgs, subCmdDef.args, "branch delete");
          const { repoName, branch, repoType, token } = parsedArgs;
          await deleteBranch({
            repo: repoType ? { type: repoType, name: repoName } : repoName,
            branch,
            accessToken: token,
            hubUrl: process.env.HF_ENDPOINT ?? HUB_URL
          });
          console.log(`Branch '${branch}' deleted successfully from repo '${repoName}'.`);
          break;
        }
        default:
          console.error(`Error: Unknown subcommand '${currentSubCommandName}' for 'branch'.`);
          console.log(listSubcommands("branch", branchCommandGroup));
          process.exitCode = 1;
          break;
      }
      break;
    }
    case "repo": {
      const repoCommandGroup = commands.repo;
      const currentSubCommandName = subCommandName;
      if (cliArgs[0] === "--help" || cliArgs[0] === "-h") {
        if (currentSubCommandName && repoCommandGroup.subcommands[currentSubCommandName]) {
          console.log(detailedUsageForSubcommand("repo", currentSubCommandName));
        } else {
          console.log(listSubcommands("repo", repoCommandGroup));
        }
        break;
      }
      if (!currentSubCommandName || !repoCommandGroup.subcommands[currentSubCommandName]) {
        console.error(`Error: Missing or invalid subcommand for 'repo'.`);
        console.log(listSubcommands("repo", repoCommandGroup));
        process.exitCode = 1;
        break;
      }
      const subCmdDef = repoCommandGroup.subcommands[currentSubCommandName];
      switch (currentSubCommandName) {
        case "delete": {
          const parsedArgs = advParseArgs(cliArgs, subCmdDef.args, `repo ${currentSubCommandName}`);
          const { repoName, repoType, token } = parsedArgs;
          const repoDesignation = repoType ? { type: repoType, name: repoName } : repoName;
          await deleteRepo({
            repo: repoDesignation,
            accessToken: token,
            hubUrl: process.env.HF_ENDPOINT ?? HUB_URL
          });
          console.log(`Repository '${repoName}' deleted successfully.`);
          break;
        }
        default:
          console.error(`Error: Unknown subcommand '${currentSubCommandName}' for 'repo'.`);
          console.log(listSubcommands("repo", repoCommandGroup));
          process.exitCode = 1;
          break;
      }
      break;
    }
    case "version": {
      if (cliArgs[0] === "--help" || cliArgs[0] === "-h") {
        console.log(detailedUsageForCommand("version"));
        break;
      }
      console.log(`hfjs version: ${version}`);
      break;
    }
    default:
      console.error("Command not found: " + mainCommandName);
      console.log(
        `
Available commands:

` + typedEntries(commands).map(([name, def]) => `  ${usage(name)}: ${def.description}`).join("\n")
      );
      console.log("\nTo get help on a specific command, run `hfjs help <command>` or `hfjs <command> --help`");
      process.exitCode = 1;
      break;
  }
}
run().catch((err) => {
  console.error("\x1B[31mError:\x1B[0m", err.message);
  console.error(err);
  process.exitCode = 1;
});
function usage(commandName, subCommandName2) {
  const commandEntry = commands[commandName];
  let cmdArgs;
  let fullCommandName = commandName;
  if ("subcommands" in commandEntry) {
    if (subCommandName2 && subCommandName2 in commandEntry.subcommands) {
      cmdArgs = commandEntry.subcommands[subCommandName2].args;
      fullCommandName = `${commandName} ${subCommandName2}`;
    } else {
      return `${commandName} <subcommand>`;
    }
  } else {
    cmdArgs = commandEntry.args;
  }
  return `${fullCommandName} ${(cmdArgs || []).map((arg) => {
    if (arg.positional) {
      return arg.required ? `<${arg.name}>` : `[${arg.name}]`;
    }
    return `[--${arg.name}${arg.short ? `|-${arg.short}` : ""}${arg.enum ? ` {${arg.enum.join("|")}}` : arg.boolean ? "" : ` <${arg.name.toUpperCase().replace(/-/g, "_")}>`}]`;
  }).join(" ")}`.trim();
}
function _detailedUsage(args, usageLine, commandDescription) {
  let ret = `usage: hfjs ${usageLine}
`;
  if (commandDescription) {
    ret += `
${commandDescription}
`;
  }
  const positionals = args.filter((p) => p.positional);
  const options = args.filter((p) => !p.positional);
  if (positionals.length > 0) {
    ret += `
Positional arguments:
`;
    for (const arg of positionals) {
      ret += `  ${arg.name}	${arg.description}${arg.default ? ` (default: ${typeof arg.default === "function" ? arg.default() : arg.default})` : ""}
`;
    }
  }
  if (options.length > 0) {
    ret += `
Options:
`;
    for (const arg of options) {
      const nameAndAlias = `--${arg.name}${arg.short ? `, -${arg.short}` : ""}`;
      const valueHint = arg.enum ? `{${arg.enum.join("|")}}` : arg.boolean ? "" : `<${arg.name.toUpperCase().replace(/-/g, "_")}>`;
      ret += `  ${nameAndAlias}${valueHint ? " " + valueHint : ""}	${arg.description}${arg.default !== void 0 ? ` (default: ${typeof arg.default === "function" ? arg.default() : arg.default})` : ""}
`;
    }
  }
  ret += `
`;
  return ret;
}
function detailedUsageForCommand(commandName) {
  const commandDef = commands[commandName];
  if ("subcommands" in commandDef) {
    return listSubcommands(commandName, commandDef);
  }
  return _detailedUsage(commandDef.args, usage(commandName), commandDef.description);
}
function detailedUsageForSubcommand(commandName, subCommandName2) {
  const commandGroup = commands[commandName];
  if (!("subcommands" in commandGroup) || !(subCommandName2 in commandGroup.subcommands)) {
    throw new Error(`Subcommand ${subCommandName2} not found for ${commandName}`);
  }
  const subCommandDef = commandGroup.subcommands[subCommandName2];
  return _detailedUsage(subCommandDef.args, usage(commandName, subCommandName2), subCommandDef.description);
}
function listSubcommands(commandName, commandGroup) {
  let ret = `usage: hfjs ${commandName} <subcommand> [options]

`;
  ret += `${commandGroup.description}

`;
  ret += `Available subcommands for '${commandName}':
`;
  ret += typedEntries(commandGroup.subcommands).map(([subName, subDef]) => `  ${subName}	${subDef.description}`).join("\n");
  ret += `

Run \`hfjs help ${commandName} <subcommand>\` for more information on a specific subcommand.`;
  return ret;
}
function advParseArgs(args, argDefs, commandNameForError) {
  const { tokens } = parseArgs({
    options: Object.fromEntries(
      argDefs.filter((arg) => !arg.positional).map((arg) => {
        const optionConfig = {
          type: arg.boolean ? "boolean" : "string",
          ...arg.short && { short: arg.short },
          ...arg.default !== void 0 && {
            default: typeof arg.default === "function" ? arg.default() : arg.default
          }
        };
        return [arg.name, optionConfig];
      })
    ),
    args,
    allowPositionals: true,
    strict: false,
    // We do custom validation based on tokens and argDefs
    tokens: true
  });
  const expectedPositionals = argDefs.filter((arg) => arg.positional);
  const providedPositionalTokens = tokens.filter((token) => token.kind === "positional");
  if (providedPositionalTokens.length < expectedPositionals.filter((arg) => arg.required).length) {
    throw new Error(
      `Command '${commandNameForError}': Missing required positional arguments. Usage: hfjs ${usage(
        commandNameForError.split(" ")[0],
        commandNameForError.split(" ")[1]
      )}`
    );
  }
  if (providedPositionalTokens.length > expectedPositionals.length) {
    throw new Error(
      `Command '${commandNameForError}': Too many positional arguments. Usage: hfjs ${usage(
        commandNameForError.split(" ")[0],
        commandNameForError.split(" ")[1]
      )}`
    );
  }
  const result = {};
  for (const argDef of argDefs) {
    if (argDef.default !== void 0) {
      result[argDef.name] = typeof argDef.default === "function" ? argDef.default() : argDef.default;
    } else if (argDef.boolean) {
      result[argDef.name] = false;
    }
  }
  providedPositionalTokens.forEach((token, i) => {
    if (expectedPositionals[i]) {
      result[expectedPositionals[i].name] = token.value;
    }
  });
  tokens.filter((token) => token.kind === "option").forEach((token) => {
    const argDef = argDefs.find((def) => def.name === token.name || def.short === token.name);
    if (!argDef) {
      throw new Error(`Command '${commandNameForError}': Unknown option: ${token.rawName}`);
    }
    if (argDef.boolean) {
      result[argDef.name] = true;
    } else {
      if (token.value === void 0) {
        throw new Error(`Command '${commandNameForError}': Missing value for option: ${token.rawName}`);
      }
      if (argDef.enum && !argDef.enum.includes(token.value)) {
        throw new Error(
          `Command '${commandNameForError}': Invalid value '${token.value}' for option ${token.rawName}. Expected one of: ${argDef.enum.join(", ")}`
        );
      }
      result[argDef.name] = token.value;
    }
  });
  for (const argDef of argDefs) {
    if (argDef.required && result[argDef.name] === void 0) {
      throw new Error(`Command '${commandNameForError}': Missing required argument: ${argDef.name}`);
    }
  }
  return Object.fromEntries(
    Object.entries(result).map(([name, val]) => [kebabToCamelCase(name), val])
  );
}
function kebabToCamelCase(str) {
  return str.replace(/-./g, (match) => match[1].toUpperCase());
}
