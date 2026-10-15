# @chtholly-fan/dsh-cpp-optimization

English | [中文](README.md)

A bundle plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) that ships one skill, **`cpp-opt-audit`**, for auditing or writing fast *and* safe low-level C++.

Its central constraint is that the **target project's actual C++ standard is detected first**: when detection fails the skill asks the user, and until the standard is confirmed it never recommends or writes a feature newer than that standard. Every finding carries a checkpoint, a reason, a bad→good code pair, and the minimum standard.

## Install

Ask the agent in a DSH session to install this package, or call the `plugin_manager` tool with the `install_bundle` action, passing the package name or the absolute path of this repository as `target`:

```
target: @chtholly-fan/dsh-cpp-optimization
```

Installation writes the profile's package dependency and selects this package's `cordis.patch.yml`. Do not edit the profile's `package.json` or `cordis.patch.yml` by hand, and do not run pnpm inside the profile directory.

The skill appears in the session catalog without a restart; replacing an already installed copy of the package requires a restart to load the new module.

## Usage

- Automatic: whenever a task touches C++ review, optimization, or low-level implementation, the catalog tells the model to load the skill first.
- Explicit: type `/cpp-opt-audit`.

The skill works in two phases: it audits read-only and reports findings with evidence, and only edits code after you agree.

## Layout

```
assets/cpp-opt-audit/
├── SKILL.md                          # rules, four-phase workflow, top checkpoints
└── references/
    ├── standard-detection.md         # standard detection, __cplusplus checks, C++17/20/23 downgrades
    ├── audit-report-template.md      # report shape, P0/P1/P2 grading
    ├── raii-ownership.md             # 1. RAII and ownership (15)
    ├── move-value-categories.md      # 2. Move semantics and value categories (12)
    ├── exception-safety.md           # 3. Exception safety (14)
    ├── performance-memory.md         # 4. Performance and memory (13)
    ├── containers-algorithms.md      # 5. Containers and algorithms (7)
    ├── concurrency.md                # 6. Concurrency (14)
    ├── templates-compile-time.md     # 7. Templates and compile time (9)
    ├── standard-boundary.md          # 8. Standard boundaries and C++20/23 mechanisms (24 + 11)
    ├── type-safety-abi.md            # 9. Type safety and ABI (13)
    └── interface-design.md           # 10. Object semantics and interfaces (13)
```

Checkpoints are grouped into ten subject areas; each names its minimum standard, and each file lists the topics that are not covered yet.

## Use as a plain filesystem skill

Without installing the plugin, copy `assets/cpp-opt-audit/` into any scanned skill root, for example `~/.dsh/skills/cpp-opt-audit/` or `<project>/.dsh/skills/cpp-opt-audit/`. The directory name is the skill name.

## Development

Host-only bundle: no runtime dependencies and no build step. `index.js` exports `apply`, `inject`, and `name` directly.

```bash
node --check index.js
node -e "import('./index.js').then(m => console.log(m.name, m.inject))"
```

`apply(ctx)` registers a provider through `ctx.skills.registerProvider(...)`. `list()` parses the `SKILL.md` frontmatter into a catalog entry, and `get()` re-reads the body on every load, so editing skill content needs no reinstall.

## Publish

```bash
npm publish --access public
```

Update the `repository` field in `package.json` to your own repository first.

## License

MIT
