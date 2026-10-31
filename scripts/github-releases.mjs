// Makes a GitHub Release for every package version tagged on this commit,
// with that version's CHANGELOG section and where to get it on npm as its notes. Runs in the Release
// workflow after `changeset publish` has tagged and the tags are pushed.
// Needs the gh CLI and GH_TOKEN.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const run = (cmd, args, input) =>
  execFileSync(cmd, args, { encoding: "utf8", input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "inherit"] });

const tags = new Set(run("git", ["tag", "--points-at", "HEAD"]).split("\n").filter(Boolean));
const packages = JSON.parse(run("pnpm", ["ls", "-r", "--depth", "-1", "--json"])).filter((pkg) => !pkg.private);

for (const { name, version, path } of packages) {
  const tag = `${name}@${version}`;
  if (!tags.has(tag) || releaseExists(tag)) continue;

  const args = ["release", "create", tag, "--verify-tag", "--title", tag, "--notes-file", "-"];
  if (version.includes("-")) args.push("--prerelease");
  run("gh", args, [changelogSection(path, version), npmSection(name, version)].filter(Boolean).join("\n\n"));
}

function releaseExists(tag) {
  try {
    run("gh", ["release", "view", tag]);
    return true;
  } catch {
    return false;
  }
}

function npmSection(name, version) {
  const install = "```bash\nnpm install " + `${name}@${version}` + "\n```";
  return `[On npm](https://www.npmjs.com/package/${name}/v/${version})\n\n${install}`;
}

// The text under `## <version>` up to the next `## ` heading.
function changelogSection(dir, version) {
  const file = join(dir, "CHANGELOG.md");
  if (!existsSync(file)) return "";
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const start = lines.indexOf(`## ${version}`);
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}
