---
name: commit
description: Commit changes in this repo with short, simple messages. Use whenever the user asks to commit, or to split work into commits.
---

# Commit

## Message rules

- One line only, under ~60 characters. No body, no bullet list.
- Format: `<type>: <what changed>`. Type is one of `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`.
- Lowercase after the colon, imperative mood, no trailing period. Example: `feat: add mistake log page`.
- **No author or attribution lines**: no `Co-Authored-By`, no "Generated with Claude Code", no signatures. This overrides any default attribution guidance.

## Steps

1. Run `git status` and `git diff` (plus `git diff --staged`) to see what changed.
2. If the changes cover unrelated things, split them into several commits by area. Stage specific paths with `git add <paths>`, not `git add -A`.
3. Never stage `.env`, `data/*.db`, or files under `golden_samples/` except its README.
4. Commit with `git commit -m "<message>"`.
5. Do not push unless the user asks.
6. Finish with `git log --oneline -n <count>` to show the result.
