# Superset Production State

Last updated: 2026-05-19, after a read-only production inspection.

## Source And Branch

- Full local source repository: `/Volumes/extend/ecode-workspace/superset-source`
- Expected current branch: `noway-release`
- Verified local branch state on 2026-05-19: `noway-release...fork/noway-release`
- Development preference: do not open a worktree unless necessary; work directly in the main checkout to avoid branch-management drift.

## Remote Runtime

- SSH alias: `agentops`
- SSH target: `ubuntu@111.230.91.24`
- Remote deployment directory: `/home/ubuntu/superset-docker`
- Remote running image: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- Local `/Volumes/extend/ecode-workspace/superset-source` has been synced with remote `/home/ubuntu/superset-docker`.
- Remote `/home/ubuntu/superset-docker/superset-source` was observed to be a plain directory, not a git repository.

## Last Observed Deployment

- Hostname: `VM-16-12-ubuntu`
- Compose file: `/home/ubuntu/superset-docker/docker-compose.yml`
- Compose project: `apache-superset`
- Compose services: `redis`, `superset`
- Superset container: `apache-superset`
- Redis container: `apache-superset-redis`
- Superset container status: `running`, Docker health `healthy`
- Superset port binding: `0.0.0.0:8088->8088/tcp`, `[::]:8088->8088/tcp`
- Container image: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- Image ID prefix: `3b3f93188d62`
- Container package version: `apache-superset 6.0.0`
- Server-local health: `http://127.0.0.1:8088/health` returned `OK`
- Public health: `http://111.230.91.24:8088/health` returned `OK`
- Recent 15-minute log scan found no `error`, `exception`, `traceback`, or `critical` lines.

## Sync Exclusions

The following must remain excluded from repository sync operations unless the user explicitly overrides:

- `.env`
- `.env.*`
- `.postgres_superset_password`
- `backup/`
- `backups/`

## Runtime Package Alignment

- `superset-source/superset/` has been overwritten with the currently deployed remote runtime package.
- Historical note: an earlier dry-run comparison against `superset-docker/superset-source/superset/` showed no differences.
- Latest read-only dry-run comparison on 2026-05-19 found drift only under `superset/static/assets`: 54 changed/new local files, 53 remote-only delete candidates, and one directory metadata item.
- Therefore, do not claim runtime package alignment without rerunning `rsync -ainc --delete` first.

## Release Process Snapshot

- The observed production release process is: local build or runtime preparation, guarded backup, rsync to `/home/ubuntu/superset-docker/superset-source`, remote Docker image rebuild with `Dockerfile.doris-zh`, `docker compose up -d superset`, Docker health wait, then HTTP and browser verification.
- The production container is image-based. Remote source sync alone does not update the running service.
- The remote deployment tree may not expose git branch metadata. For release provenance, use the local source branch/commit, remote sync evidence, rebuilt image ID, selected asset checksums, and live HTTP/browser verification.
- Historical crosstab release evidence from session `019e3ef4-0e7b-71c0-a5d7-383473f63477` ended on image ID prefix `3b3f93188d62` and verified the production UI no longer showed the missing visualization registration error.

## Project Instructions

- Follow DRY, KISS, YAGNI, SOLID.
- Keep code clean.
- Avoid nonessential fallback coding; fail fast when required conditions are absent.
- Follow Apache Superset modernization expectations: typed frontend/backend code, no new JavaScript files, no `any`, prefer `@superset-ui/core` wrappers, unit tests first, and type hints for new Python code.
