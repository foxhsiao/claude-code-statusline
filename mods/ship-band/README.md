# ship-band

A band above the prompt: `發佈 │ <branch> │ PR #N 未合併 │ CI ✓ │ 部署 ✓ 最新 │ 工作區 ✓ 乾淨 │ ↑2 未推送`.

| Item | Where it comes from |
|---|---|
| PR, merged or not | `gh pr view` for the current branch (a branch with no PR shows `無 PR`, or `✓ 已進 main` if it already landed) |
| CI | the PR's `statusCheckRollup`: `✓` pass, `✗` fail, `●` running, `—` none |
| Production runs main's latest | optional, see below |
| Working tree clean | `git status --porcelain`; unpushed and behind counts from the upstream |

The network reads (`git fetch`, `gh`, the deploy URL) run at most once a minute, after a turn ends, and after a `gh pr`, `git push`, `wrangler` or `deploy` command. They never block a tool call.

## Production check

Add `.ship-band.json` at the repo root:

```json
{ "deploy": { "url": "https://example.com/version.json" } }
```

The band fetches the URL, takes the first commit-looking token (7–40 hex characters) from the body and compares it with `origin/<default branch>`. The site has to expose its commit for this to work.

Optional fields: `"header": "x-commit"` reads that response header instead of the body, `"pattern": "sha=([0-9a-f]+)"` picks the token yourself (the first group when it has one).

Without the file, the production item is left out.

## Notes

- It hides itself outside a git repository.
- `ui.render` on `AbovePrompt` draws one tree per session. This mod draws above whatever the mods beneath it draw; a mod that returns its tree without calling `next` hides every mod beneath it.
