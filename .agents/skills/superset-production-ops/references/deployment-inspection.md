# Deployment Inspection

Use this reference for read-only production status checks and pre-deployment evidence collection.

## Read-Only Status Check

Run from `/Volumes/extend/ecode-workspace/superset-source`:

```bash
git status --short --branch
curl -fsS http://localhost:8088/health || true
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops 'printf "ssh-ok\n" && hostname && date -Is && test -d /home/ubuntu/superset-docker && printf "superset-docker-dir-ok\n"'
```

Local `localhost:8088` may be down even when production is healthy. Treat it as local dev-server evidence only.

## Remote Compose And Container Evidence

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops 'cd /home/ubuntu/superset-docker && bash -s' <<'REMOTE'
set -u
printf 'PWD=%s\n' "$PWD"
printf 'COMPOSE_FILES\n'
find . -maxdepth 1 -type f \( -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' -o -name 'compose.yml' -o -name 'compose.yaml' \) -print | sort
printf 'COMPOSE_SERVICES\n'
docker compose config --services 2>&1 || true
printf 'COMPOSE_PS\n'
docker compose ps 2>&1 || true
printf 'DOCKER_PS_SUPERSET\n'
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | grep -E 'superset|apache-superset-doris' || true
printf 'IMAGE_MATCH\n'
docker image ls --format '{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}' | grep '^apache-superset-doris:6.0.0-zh-column-scheme-matrix' || true
printf 'HEALTH_LOCAL_8088\n'
curl -fsS http://127.0.0.1:8088/health 2>&1 || true
REMOTE
```

Expected healthy deployment shape:

- compose services: `redis`, `superset`
- containers: `apache-superset`, `apache-superset-redis`
- Superset image: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- Superset status: `Up ... (healthy)`
- port binding: `0.0.0.0:8088->8088/tcp`
- server-local health returns `OK`

## Package, Logs, And Public Health

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops 'bash -s' <<'REMOTE'
set -u
printf 'PACKAGE_VERSION\n'
docker exec apache-superset python -c 'import importlib.metadata as m; print(m.version("apache-superset"))' 2>&1 || true
printf 'APP_PATHS\n'
docker exec apache-superset sh -c 'python -c "import superset, os; print(os.path.dirname(superset.__file__))" && test -d /app/superset/static/assets && ls /app/superset/static/assets | wc -l' 2>&1 || true
printf 'RECENT_LOGS_ERRORS\n'
docker logs --since 15m apache-superset 2>&1 | grep -Ei 'error|exception|traceback|critical' | tail -n 20 || true
REMOTE

curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health || true
```

## Runtime Tree Dry-Run

Always compare before claiming local/remote runtime package alignment:

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

Summary command:

```bash
rsync -ainc --delete \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.postgres_superset_password' \
  --exclude='backup/' \
  --exclude='backups/' \
  /Volumes/extend/ecode-workspace/superset-source/superset/ \
  agentops:/home/ubuntu/superset-docker/superset-source/superset/ |
  grep -v '^$' |
  awk '
    /^\*deleting / {del++; next}
    /^[<>]f/ {file++; next}
    /^[<>]d/ {dir++; next}
    {other++}
    END {printf "changed_or_new_files=%d\nchanged_dirs=%d\ndelete_entries=%d\nother_entries=%d\n", file, dir, del, other}'
```

Interpretation:

- no nonblank output: compared trees are aligned.
- `*deleting`: remote-only entries that a real sync would remove.
- `<f+++++++` or `>f...`: file-level differences.
- differences under `static/assets` usually mean frontend build artifact drift.

## Reporting Template

Report a direct verdict:

- `complete`: production status was inspected and evidence is sufficient.
- `blocked`: SSH, Docker, compose, or HTTP checks could not run.
- `partial`: health is known but runtime tree, image, or logs were not verified.

Separate evidence into local git state, remote filesystem/sync state, container/image state, logs, and HTTP health.
