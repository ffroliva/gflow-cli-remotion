# GitHub Copilot instructions

When working on any Remotion composition (files under `src/remotion/`), always load and follow the Remotion skill:

- **Core skill:** [`skills/remotion/SKILL.md`](../skills/remotion/SKILL.md)
- **Supplementary rules:** [`skills/remotion/rules/`](../skills/remotion/rules/) — load the relevant rule file for the task (see the lookup table in `AGENTS.md`).

Key invariants — never violate:
- No CSS transitions or animations — use `interpolate()` + `useCurrentFrame()`.
- No Tailwind animation classes.
- Assets go in `public/`; reference via `staticFile()`.

For all other project context (hard boundaries, testing, code style, PR instructions) see [`AGENTS.md`](../AGENTS.md).
