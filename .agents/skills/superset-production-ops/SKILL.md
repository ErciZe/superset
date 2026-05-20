---
name: superset-production-ops
description: Use when operating, validating, syncing, deploying, or diagnosing the Superset production deployment tied to /Volumes/extend/ecode-workspace/superset-source, agentops, /home/ubuntu/superset-docker, noway-release, or the apache-superset-doris image.
---

# Superset Production Ops

## Overview

Use this skill for production operations around the local Superset source checkout and the paired remote Docker deployment. Keep work read-only unless the user asks for deployment or repair, and separate local, remote filesystem, container, and HTTP evidence.

## Required Context

Before changing or diagnosing anything:

1. Read `references/production-state.md` for the current source path, branch, remote host, deployment path, image tag, and sync exclusions.
2. Read `references/deployment-inspection.md` when the user asks to understand deployment status, verify production health, compare local/remote runtime packages, or prepare a sync/deploy.
3. Read `references/release-flow.md` when the user asks to release, deploy, rebuild production, verify a production rollout, or understand the historical publishing process from session `019e3ef4-0e7b-71c0-a5d7-383473f63477`.

## Operating Rules

- Work in `/Volumes/extend/ecode-workspace/superset-source` unless the user gives another path.
- Default branch context is `noway-release`; verify with `git status --short --branch` before source changes.
- Do not create a worktree unless explicitly necessary; prefer direct work in the current checkout.
- Use SSH alias `agentops` for the production host when remote inspection is required.
- Preserve `.env`, `.env.*`, `.postgres_superset_password`, `backup/`, and `backups/` during local-to-remote or remote-to-local syncs.
- Treat prior sync notes as historical. Always run a fresh dry-run comparison before claiming local and remote `superset/` are aligned.
- Prefer fast failure over speculative fallback code. If a required host, credential, container name, or environment value is missing, stop and report the exact missing input.
- Keep code changes DRY, KISS, YAGNI, SOLID, and consistent with Apache Superset modernization rules: typed Python, typed TypeScript, no new `any`, no direct Ant Design imports when Superset UI wrappers exist.

## Quick Checks

Start with focused checks:

```bash
git status --short --branch
git rev-parse --abbrev-ref HEAD
curl -f http://localhost:8088/health
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops 'hostname && date -Is && test -d /home/ubuntu/superset-docker'
```

For production status, use the inspection workflow in `references/deployment-inspection.md`. Key expected checks are:

- `docker compose ps` from `/home/ubuntu/superset-docker`
- `docker inspect apache-superset`
- local-on-server health: `curl -fsS http://127.0.0.1:8088/health`
- external health: `curl -fsS http://111.230.91.24:8088/health`
- dry-run runtime comparison with `rsync -ainc --delete`

For release/deployment execution, use the guarded workflow in `references/release-flow.md`.

## Sync Guardrail

If validating sync state, dry-run first and keep sensitive/local-only paths excluded:

```bash
rsync -ainc --delete \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.postgres_superset_password' \
  --exclude='backup/' \
  --exclude='backups/' \
  /Volumes/extend/ecode-workspace/superset-source/superset/ \
  agentops:/home/ubuntu/superset-docker/superset-source/superset/
```

Interpretation:

- no nonblank output means the compared trees are aligned.
- `*deleting ...` means remote-only entries would be removed by a real `--delete` sync.
- `<f+++++++ ...` or `>f... ...` means file content/path differences exist and require a sync decision.
- Differences concentrated in `superset/static/assets` usually indicate frontend build artifact drift, not Python package drift.

## Deployment Notes

- Current production image recorded for this environment: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`.
- Production is image-based. Remote source or asset sync alone is not a completed release; rebuild the image and recreate/restart the `superset` compose service before claiming production reflects the change.
- For container/runtime inspection, first identify the active compose project and container names from the remote deployment directory instead of guessing them.
- When comparing local runtime code to remote runtime code, compare `superset-source/superset/` against the deployed `superset-docker/superset-source/superset/` tree with exclusions applied.
- Report evidence separately: local git state, remote filesystem diff, container image/runtime state, and health/API checks are different evidence classes.
- Remote `/home/ubuntu/superset-docker/superset-source` may not be a git repository. Do not require remote branch/commit evidence when `.git` is absent; use filesystem, container, image, and health evidence instead.

## When Reporting

End with a direct verdict:

- `complete`: requested operation was performed and verified.
- `blocked`: missing credential, missing host, failing health check, or unresolved remote mismatch prevents safe completion.
- `partial`: local work is done but remote validation or deployment evidence is absent.

Include exact commands run and the meaningful result, but do not dump noisy logs unless the user asks.
