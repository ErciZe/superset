# Production Release Flow

Use this reference when releasing changes to the Superset production server or when explaining the observed deployment process from session `019e3ef4-0e7b-71c0-a5d7-383473f63477`.

## Release Model

- Local source of record: `/Volumes/extend/ecode-workspace/superset-source`.
- Remote deployment root: `/home/ubuntu/superset-docker`.
- Remote compose service to recreate: `superset`.
- Running container: `apache-superset`.
- Running image tag: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`.
- The remote `superset-source` directory is usually a plain filesystem tree, not a git checkout.
- The live container is image-based. It does not bind mount the full source tree; observed runtime mounts were only `superset_home` and `/app/pythonpath:ro`.
- Therefore, a production release requires image rebuild and service recreation after any source or asset sync. File sync alone is pre-release staging, not deployment.

## Preflight

Run local state checks before modifying or publishing:

```bash
git status --short --branch
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
```

For frontend changes, build assets from the frontend workspace:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=testableProduction npm run build
```

If validating a specific asset-level frontend fix, inspect the built chunks for the expected stable strings or test selectors before syncing. Example checks used during the historical crosstab release included registration strings and `data-test` evidence in generated chunks.

## Remote Backup

Create a timestamped backup on the remote host before replacing deployed assets or runtime files. Quote remote scripts so timestamp variables expand on the remote host, not in the local shell:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && bash -s' <<'REMOTE'
set -euo pipefail
ts="$(date +%Y%m%d%H%M%S)"
mkdir -p backups
cp -a superset-source/superset/static/assets "backups/assets-$ts"
printf 'assets_backup=%s\n' "backups/assets-$ts"
REMOTE
```

Avoid unquoted local commands like `ssh agentops "... $ts ..."` because local shell expansion can produce incorrect paths such as `backups/assets-`.

## Sync

Dry-run before syncing:

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

For an asset-only frontend release, sync only assets after a successful build:

```bash
rsync -az --delete \
  /Volumes/extend/ecode-workspace/superset-source/superset/static/assets/ \
  agentops:/home/ubuntu/superset-docker/superset-source/superset/static/assets/
```

For broader runtime changes, sync the runtime tree with the same exclusions used in the dry-run. Preserve `.env`, `.env.*`, `.postgres_superset_password`, `backup/`, and `backups/`.

## Image Rebuild And Restart

Rebuild the production image tag on the remote host:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker build -f Dockerfile.doris-zh -t apache-superset-doris:6.0.0-zh-column-scheme-matrix .'
```

Recreate/restart the Superset service:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker compose up -d superset && docker ps --format "{{.Names}} {{.Status}}" | grep apache-superset'
```

Wait for Docker health:

```bash
ssh agentops 'for i in $(seq 1 24); do status="$(docker inspect -f "{{.State.Health.Status}}" apache-superset 2>/dev/null || true)"; printf "%s\n" "$status"; test "$status" = healthy && exit 0; sleep 5; done; exit 1'
```

## Verification

Minimum verification after restart:

```bash
ssh agentops 'curl -fsS http://127.0.0.1:8088/health'
curl -I --max-time 20 http://111.230.91.24:8088/
curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health
ssh agentops 'docker inspect -f "{{.Image}} {{.State.Status}} {{.State.Health.Status}}" apache-superset'
```

For UI-facing releases, perform browser verification against production and capture evidence for the changed workflow. During the crosstab release, acceptance included:

- production page no longer showed the missing visualization registration error.
- Explore loaded the expected visualization type.
- the query returned rows.
- the DOM contained the expected test selector.
- a screenshot was captured.

## Branch And Provenance Boundary

Because `/home/ubuntu/superset-docker/superset-source` may not be a git repository, do not claim the remote server is "on branch X". Instead report provenance as:

- local branch and commit used to build/sync.
- remote filesystem sync evidence.
- container image ID or digest after rebuild.
- selected local-to-container asset checksums when exact file provenance matters.
- HTTP/browser verification evidence.

Historical example: the `019e3ef4-0e7b-71c0-a5d7-383473f63477` release verified that deployed content came from local branch `feat/ag-grid-column-view-scheme`, but the remote deployment directory itself had no branch metadata.

## Reporting

Use this status language:

- `complete`: assets/runtime were synced, image was rebuilt, service was recreated, Docker health and HTTP health passed, and any user-facing workflow was verified.
- `partial`: sync/build happened but one of rebuild, restart, health, or browser verification is missing.
- `blocked`: a preflight, build, backup, SSH, Docker, health, or verification step failed and production state should not be claimed as updated.
