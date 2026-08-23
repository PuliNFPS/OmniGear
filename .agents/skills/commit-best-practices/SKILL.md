---
name: commit-best-practices
description: Prepare and create safe, focused Git commits using task branches and the repository's feat/bug message convention. Use when asked to stage, commit, or organize changes for a commit; do not use for read-only Git history questions.
---

# Commit Best Practices

Create reviewable commits without risking the default branch or mixing unrelated work.

## Protect the Default Branch

- Inspect `git status --short --branch` before staging or committing.
- For every new commit task, create one new task-specific branch before committing. Never commit on `main`, `master`, `trunk`, or the branch targeted by `origin/HEAD`.
- Name feature branches `feat/<short-kebab-summary>` and bug-fix branches `bug/<short-kebab-summary>`.
- If uncommitted work already exists, preserve it when creating the task branch. Do not discard, overwrite, reset, or silently include changes that may belong to the user.
- If the current non-default branch is explicitly intended for the task, ask before replacing it only when creating another branch could separate or duplicate existing work.

## Keep the Commit Focused

- Review the working-tree diff and untracked files before staging.
- Stage explicit paths or deliberate hunks. Do not use broad staging when it could capture unrelated files.
- Review `git diff --cached` before committing. The staged diff must contain one coherent change and no accidental formatting churn, generated output, dependencies, debug artifacts, credentials, tokens, private keys, or local environment files.
- Split independent changes into separate commits. Leave unrelated user changes untouched.

## Verify the Change

- Run the smallest relevant tests, linting, type checks, or build checks before committing.
- Do not bypass hooks with `--no-verify`. If a check fails, report the failure and fix only issues within the task's scope.
- Avoid committing incomplete code, commented-out experiments, or unexplained temporary work unless the user explicitly requests a checkpoint commit.

## Write the Message

Use exactly one of these subject formats:

- `feat: <short concise summary>` for new behavior or an intentional improvement.
- `bug: <short concise summary>` for a defect correction.

Write the summary in imperative, present-tense language. Keep it specific, lowercase when natural, no trailing period, and preferably at most 72 characters including the prefix. Add a body only when it explains important motivation, constraints, or consequences that the diff cannot show.

## Finish Safely

- Create a commit only when the user requested a commit or clearly authorized the committing workflow.
- Do not amend, rebase, force-push, delete branches, or rewrite history without explicit authorization.
- Do not push or open a pull request unless requested.
- After committing, verify the branch, commit hash, subject, and remaining working-tree status. Report the checks run and clearly identify any uncommitted files left behind.
