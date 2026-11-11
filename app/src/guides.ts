import type { Action } from "./data";

/** A paragraph, numbered steps, a list of terms, or a short aside. */
export type Block = { text: string } | { steps: string[] } | { terms: [string, string][] } | { aside: string } | { code: string };

export interface Guide {
  id: GuideId;
  group: "start" | "needs-you" | "failed";
  title: string;
  summary: string;
  body: Block[];
}

export type GuideId =
  | "how-it-works"
  | "glossary"
  | "needs-you"
  | "windows-update"
  | "your-standard"
  | "duplicates"
  | "developer-tools"
  | "high-risk"
  | "app-running"
  | "stalled-download"
  | "download-refused"
  | "installer-technology"
  | "another-install"
  | "restart"
  | "no-applicable-update"
  | "permission-declined"
  | "restore-point"
  | "other-failure";

export const groups: { id: Guide["group"]; title: string }[] = [
  { id: "start", title: "Getting started" },
  { id: "needs-you", title: "Updates that need you" },
  { id: "failed", title: "When an update fails" },
];

export const guides: Guide[] = [
  {
    id: "how-it-works",
    group: "start",
    title: "How Workbench Station works",
    summary: "What the audit looks at, and what happens when you install.",
    body: [
      { text: "Workbench Station keeps this PC up to date in three steps, and you stay in charge of each one." },
      {
        steps: [
          "Audit. It reads the apps, developer tools and settings on this PC and checks online for newer versions. It only reads: nothing changes, and it takes a few minutes.",
          "Choose. Updates shows what can be updated, how risky each one is, and the exact command it would run. Nothing is selected for you.",
          "Install. Windows asks for permission once, the updates you chose run one by one, and then the PC is audited again to check that each one really landed.",
        ],
      },
      { text: "Some updates never run from here: the ones marked high risk, and the ones that need you, which have no command. Their guides explain how to do them yourself." },
      { aside: "An update list older than a day is locked. Versions move fast, so audit again before installing." },
    ],
  },
  {
    id: "glossary",
    group: "start",
    title: "Words you'll see",
    summary: "Risk, undo, Needs you, your standard and the rest, in plain terms.",
    body: [
      {
        terms: [
          ["Low risk", "A routine update from a trusted source, such as a newer version of an app through WinGet. Safe to install in a batch."],
          ["Medium risk", "Worth a look first, for example a jump to a new major version that may change how a tool behaves."],
          ["High risk", "It could break a setup you rely on. It never runs from here; its guide explains how to do it yourself."],
          ["Restore point", "A snapshot of Windows settings, drivers and installed programs that you can go back to. Your own files aren't touched. It's optional when installing."],
          ["Can be undone", "You can go back to the previous version or setting if you need to. \"Cannot be undone\" means plan for it."],
          ["Needs you", "Something the audit found that has no safe command, so you do it yourself. Each one links to its guide."],
          ["Your standard", "The rules this PC is checked against, such as which Node.js versions to keep. Overview shows how many it meets."],
          ["Duplicates", "The same tool installed more than once, or repeated entries in PATH, which can make the wrong version run."],
          ["Developer tools", "SDKs and toolchains such as Node.js, Python, Flutter or Rust, which update through their own tools."],
        ],
      },
    ],
  },
  {
    id: "needs-you",
    group: "needs-you",
    title: "Updates without a command",
    summary: "What to do with anything listed under Needs you.",
    body: [
      { text: "These are things the audit found but can't fix safely on its own. Each one says what it found; you make the change, and the next audit checks it." },
      {
        steps: [
          "Open the update in Updates and read what it found.",
          "Make the change yourself. The guides in this group cover the common kinds.",
          "Audit this PC again from Overview. The item disappears once it's done.",
        ],
      },
    ],
  },
  {
    id: "windows-update",
    group: "needs-you",
    title: "Windows and driver updates",
    summary: "Install them from Windows Update, which knows how to restart safely.",
    body: [
      { text: "Workbench Station lists pending Windows and driver updates so nothing is missed, but installing them stays with Windows Update." },
      {
        steps: [
          "Open Settings > Windows Update and choose Check for updates.",
          "Install what it offers. For drivers, open Advanced options > Optional updates.",
          "Restart when Windows asks, then audit this PC again.",
        ],
      },
    ],
  },
  {
    id: "your-standard",
    group: "needs-you",
    title: "Meeting your standard",
    summary: "Rules about versions, tools and settings that this PC doesn't meet yet.",
    body: [
      { text: "Your standard describes how this PC should be set up: which versions to keep, which tools to use, and how projects should be pinned. A rule that isn't met shows up under Needs you with what's missing." },
      {
        steps: [
          "Read the rule in the update's detail. It names the tool, the version or the setting.",
          "Install, configure or remove what it describes, using that tool's own installer or settings.",
          "Audit this PC again. Overview's score goes up once the rule is met.",
        ],
      },
      { aside: "If a rule doesn't fit how you work, it can be changed in the standard (config/workstation.policy.json in the repository) instead of on this PC." },
    ],
  },
  {
    id: "duplicates",
    group: "needs-you",
    title: "Removing duplicates",
    summary: "The same tool twice, or repeated PATH entries.",
    body: [
      { text: "When a tool is installed more than once, the one that runs depends on PATH order, and updating one copy can leave the old one in charge." },
      {
        steps: [
          "Read which copies or entries the update lists.",
          "Keep the copy you use and uninstall the others from Settings > Apps.",
          "For repeated PATH entries, search Windows for \"Edit the system environment variables\", choose Environment Variables, and remove the repeats from Path.",
          "Open a new terminal, then audit this PC again.",
        ],
      },
    ],
  },
  {
    id: "developer-tools",
    group: "needs-you",
    title: "Developer tools",
    summary: "SDKs and toolchains that update through their own tools.",
    body: [
      { text: "Some developer tools have their own updater, and a few must not be updated from outside. When there's no safe command, update them the way the tool expects." },
      {
        steps: [
          "Read which tool and version the update names.",
          "Use the tool's own updater, for example rustup update, flutter upgrade or nvm install, or its official installer.",
          "Open a new terminal and audit this PC again.",
        ],
      },
    ],
  },
  {
    id: "high-risk",
    group: "needs-you",
    title: "High-risk updates",
    summary: "Why they don't run from here, and how to do them carefully.",
    body: [
      { text: "A high-risk update could break a setup you rely on, such as a database or a runtime your projects are pinned to. Workbench Station shows the exact command but never runs it, so you choose the moment." },
      {
        steps: [
          "Read the update's detail and check what depends on that tool.",
          "Back up what matters, for example database data or project lockfiles.",
          "Copy the command from the detail and run it in a terminal when you have time to deal with the result.",
          "Audit this PC again to confirm the new version.",
        ],
      },
    ],
  },
  {
    id: "app-running",
    group: "failed",
    title: "The app was running",
    summary: "Close the app, or the windows that use it, and retry.",
    body: [
      { text: "Many installers stop when the app they update is open. Git, for example, can't update while a Git Bash window is open." },
      {
        steps: [
          "Close the app, and any of its windows in the taskbar's hidden icons.",
          "If History named programs that were using it, close those too.",
          "Choose Retry in History, or select the update again in Updates.",
        ],
      },
      { aside: "When an install starts, Overview lists the running apps that would block their own update, so you can close them in time." },
    ],
  },
  {
    id: "stalled-download",
    group: "failed",
    title: "The download stalled",
    summary: "WinGet's downloader hung; switch it to the standard one.",
    body: [
      { text: "WinGet downloads through Delivery Optimization by default, and on some networks it hangs until the install times out. Switching WinGet to the standard Windows downloader fixes it." },
      {
        steps: [
          "Open a terminal and run winget settings. It opens WinGet's settings file.",
          "Add the network setting below, keeping any settings already there, and save.",
          "Choose Retry in History.",
        ],
      },
      { code: '"network": {\n  "downloader": "wininet"\n}' },
      { aside: "From the command line, Update-Workstation.ps1 -FixWinGetDownloader makes the same change after asking, and backs up the settings first." },
    ],
  },
  {
    id: "download-refused",
    group: "failed",
    title: "The download was refused",
    summary: "The vendor's server said no for now; retry later.",
    body: [
      { text: "The vendor's download server refused the request (HTTP 403). It's usually temporary, often a rate limit, and nothing on this PC changed." },
      { steps: ["Wait a while, an hour is usually enough.", "Choose Retry in History."] },
    ],
  },
  {
    id: "installer-technology",
    group: "failed",
    title: "The installer changed",
    summary: "The new version installs differently; reinstall it.",
    body: [
      { text: "The new version uses a different kind of installer than the one on this PC, so it can't update in place." },
      {
        steps: [
          "Uninstall the app from Settings > Apps. Your files and settings usually stay.",
          "Install the new version from the vendor's site or with winget install.",
          "Audit this PC again.",
        ],
      },
    ],
  },
  {
    id: "another-install",
    group: "failed",
    title: "Another install was running",
    summary: "Windows installs one thing at a time; retry when it ends.",
    body: [
      { text: "Windows only runs one installer at a time. Another install, often Windows Update or an app updating itself, was busy." },
      { steps: ["Wait for the other install to finish.", "Choose Retry in History."] },
    ],
  },
  {
    id: "restart",
    group: "failed",
    title: "Restart to finish",
    summary: "It installed; Windows needs a restart to complete it.",
    body: [
      { text: "The update installed, but some of its files are in use until Windows restarts." },
      { steps: ["Save your work and restart Windows.", "Audit this PC again to confirm the new version."] },
    ],
  },
  {
    id: "no-applicable-update",
    group: "failed",
    title: "No update applies here",
    summary: "WinGet can't update this copy; update it from the app.",
    body: [
      { text: "WinGet sees a newer version but none that fits how this copy was installed, for example an app that updates itself or one installed for a single user." },
      { steps: ["Open the app and use its own Check for updates.", "Audit this PC again."] },
    ],
  },
  {
    id: "permission-declined",
    group: "failed",
    title: "Windows permission was declined",
    summary: "Nothing was installed; choose Yes when Windows asks.",
    body: [
      { text: "Installing needs administrator permission, which Windows asks for once per install. When the prompt is declined or closed, nothing runs." },
      { steps: ["Choose the updates again in Updates and install.", "When Windows asks whether to allow changes, choose Yes."] },
    ],
  },
  {
    id: "restore-point",
    group: "failed",
    title: "No restore point",
    summary: "Windows couldn't make one, so nothing was installed.",
    body: [
      { text: "You asked for a restore point before installing. Windows couldn't create it, so nothing was installed. Usually System Protection is off for the system drive." },
      {
        steps: [
          "Search Windows for \"Create a restore point\" and open it.",
          "Select the system drive, usually C:, choose Configure, then Turn on system protection. Give it a few percent of the disk.",
          "Choose the updates again in Updates and install.",
        ],
      },
      { aside: "To install without one, clear Create a restore point first in the confirmation. To go back later, open the same window and choose System Restore." },
    ],
  },
  {
    id: "other-failure",
    group: "failed",
    title: "Any other failure",
    summary: "Read the reason, check the installer log, then retry.",
    body: [
      { text: "History shows the reason the installer gave. When it names an installer log, the last lines of that log usually explain the cause." },
      {
        steps: [
          "Read the reason in History, and open the installer log if it lists one.",
          "Fix what it names, then choose Retry.",
          "If it keeps failing, run the command from the update's detail in a terminal to see the full output.",
        ],
      },
    ],
  },
];

export const guideById = new Map(guides.map((guide) => [guide.id, guide]));

/** The guide for an update the app won't run on its own, or null when it runs from here. */
export function guideForAction(action: Action): GuideId | null {
  if (action.command !== null) return action.risk === "high" ? "high-risk" : null;
  const bySource: Record<string, GuideId> = {
    "windows-update": "windows-update",
    policy: "your-standard",
    consolidation: "duplicates",
    toolchain: "developer-tools",
  };
  return bySource[action.source.type] ?? "needs-you";
}

/** The guide for a failed update, from the reason the engine recorded. */
export function guideForFailure(reason: string | null): GuideId {
  const text = reason ?? "";
  // Older logs only kept WinGet's exit code, so each cause also matches its code, as a number or in hex.
  const causes: [RegExp, GuideId][] = [
    [/is running|programs were using it|-1978334975|0x8A150101/i, "app-running"],
    [/download stalled/i, "stalled-download"],
    [/HTTP 403|refused the download|-2145844845|0x80190193/i, "download-refused"],
    [/different installer technology|-1978335090|0x8A15008E/i, "installer-technology"],
    [/Another installation|-1978334974|0x8A150102/i, "another-install"],
    [/restart Windows|-1978334967|0x8A150109/i, "restart"],
    [/no update that applies|-1978335189|0x8A15002B/i, "no-applicable-update"],
    [/restore point/i, "restore-point"],
    [/permission/i, "permission-declined"],
  ];
  return causes.find(([pattern]) => pattern.test(text))?.[1] ?? "other-failure";
}
