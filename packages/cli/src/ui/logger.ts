import pc from "picocolors";

export const logger = {
  banner: () => {
    console.log(
      pc.bold(pc.cyan("\n┌  giltflow")) + pc.dim(" v0.1.0 — Continuous Code Localization"),
    );
  },
  step: (message: string) => {
    console.log(pc.cyan("◇  ") + message);
  },
  info: (message: string) => {
    console.log(pc.dim("│  ") + message);
  },
  success: (message: string) => {
    console.log(pc.dim("│  ") + pc.green("✔ ") + message);
  },
  warn: (message: string) => {
    console.log(pc.dim("│  ") + pc.yellow("⚠ ") + message);
  },
  error: (message: string) => {
    console.log(pc.dim("│  ") + pc.red("✖ ") + message);
  },
  done: (message: string) => {
    console.log(pc.bold(pc.cyan("└  ")) + pc.green(message) + "\n");
  },
};
