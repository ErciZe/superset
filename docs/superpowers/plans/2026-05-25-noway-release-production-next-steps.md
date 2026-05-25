# Noway Release Production Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare and publish the internal `noway-release` branch safely without merging upstream `origin/master` wholesale.

**Architecture:** Keep `plugin-chart-ag-grid-table-scheme` as the independent `noway table v1` component, keep `plugin-chart-crosstab-table` as the separate crosstab component, and treat Chinese translations as a separate release surface. Production deployment remains image-based: local source is built, assets/runtime are synced to `/home/ubuntu/superset-docker`, the `apache-superset-doris:6.0.0-zh-column-scheme-matrix` image is rebuilt, and the `superset` service is recreated before verification.

**Tech Stack:** Apache Superset frontend, React, TypeScript, Jest, npm package-lock, rsync, Docker Compose, remote host alias `agentops`.

---

## File Structure

- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/package.json`
  - Declare direct runtime/tooling dependencies used by the scheme-local runtime.
- Modify: `superset-frontend/package-lock.json`
  - Keep package lock aligned with the scheme dependency manifest.
- Review/commit separately: `superset/translations/zh/LC_MESSAGES/messages.po`
  - Keep zh translation changes separate from component code.
- Review/commit separately: `docs/superpowers/plans/*`, `docs/superpowers/specs/*`, `docs/superpowers/reports/*`
  - Keep only release-relevant planning and evidence documents.
- No direct upstream merge target:
  - Do not merge `origin/master` into `noway-release` in this plan.
  - Use upstream only as a reference for selective later patching.

## Task 1: Close the Noway Table V1 Dependency Gap

**Files:**

- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/package.json`
- Modify: `superset-frontend/package-lock.json`

- [ ] **Step 1: Confirm undeclared direct dependencies**

Run from repository root:

```bash
rg -n "tinycolor2|prettier/standalone|prettier/plugins" \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/package.json
```

Expected: `tinycolor2` is used in `src/table/utils/useTableTheme.ts`; `prettier/*` is used in `src/matrix/cellFormatter.ts`; package manifest does not yet declare them.

- [ ] **Step 2: Add direct dependencies**

Update `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/package.json` dependencies to include:

```json
"@types/tinycolor2": "^1.4.3",
"prettier": "3.6.2",
"tinycolor2": "^1.4.2"
```

Expected: the scheme package no longer depends on root-project incidental dependencies for its local table runtime and formatter editor path.

- [ ] **Step 3: Refresh the lockfile**

Run from `superset-frontend`:

```bash
npm install --package-lock-only --ignore-scripts
```

Expected: `superset-frontend/package-lock.json` records the added dependencies under `plugins/plugin-chart-ag-grid-table-scheme`.

- [ ] **Step 4: Validate package dependency closure**

Run from repository root:

```bash
rg -n "tinycolor2|prettier" \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/package.json \
  superset-frontend/package-lock.json
```

Expected: both package manifest and lockfile contain the scheme dependency entries.

- [ ] **Step 5: Commit dependency closure**

```bash
git add \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/package.json \
  superset-frontend/package-lock.json
git commit -m "fix(noway-table): declare local runtime dependencies"
```

## Task 2: Revalidate Isolated Components Locally

**Files:**

- Test only: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test`
- Test only: `superset-frontend/plugins/plugin-chart-crosstab-table/test`

- [ ] **Step 1: Run noway table v1 tests**

Run from `superset-frontend`:

```bash
BABEL_ENV=test npx jest plugins/plugin-chart-ag-grid-table-scheme/test --runInBand
```

Expected: all scheme tests pass. Existing duplicate Jest mock, stale Browserslist, and AntD deprecation warnings can be recorded as baseline warnings if tests pass.

- [ ] **Step 2: Run crosstab tests**

Run from `superset-frontend`:

```bash
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand --silent
```

Expected: all crosstab tests pass. If AppleDouble `._*` files are discovered and Jest fails on binary content, remove those sidecar files and rerun before treating it as product failure.

- [ ] **Step 3: Run TypeScript validation**

Run from `superset-frontend`:

```bash
npm run type
```

Expected: pass, or report any repo-baseline failures separately from changed component failures.

- [ ] **Step 4: Run isolation checks**

Run from repository root:

```bash
rg -n "plugin-chart-ag-grid-table/src|@superset-ui/plugin-chart-ag-grid-table/src" \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test

rg -n "renderColumnViewToolbar|columnViewToolbarHeight|additionalCellStyle|additionalCellFormatter" \
  superset-frontend/plugins/plugin-chart-ag-grid-table \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src
```

Expected: first command has no output. Second command matches only under `plugin-chart-ag-grid-table-scheme/src`, not official `plugin-chart-ag-grid-table`.

## Task 3: Clean and Commit the Release Scope

**Files:**

- Review: `docs/superpowers/plans/*`
- Review: `docs/superpowers/specs/*`
- Review: `docs/superpowers/reports/*`
- Review: `superset/translations/zh/LC_MESSAGES/messages.po`

- [ ] **Step 1: Inspect dirty and untracked state**

Run from repository root:

```bash
git status --short --branch
git diff --stat
git ls-files --others --exclude-standard docs/superpowers .superpowers | sed -n '1,200p'
```

Expected: identify exactly which docs/reports and translation changes are release-relevant.

- [ ] **Step 2: Commit release-relevant docs only**

Stage only the plan/spec/report files that should be durable release evidence:

```bash
git add \
  docs/superpowers/plans/2026-05-25-noway-table-v1-isolation.md \
  docs/superpowers/specs/2026-05-25-noway-release-table-isolation-design.md \
  docs/superpowers/reports/2026-05-25-noway-table-v1-isolation-validation.md \
  docs/superpowers/plans/2026-05-25-noway-release-production-next-steps.md
git commit -m "docs(noway-release): record production next steps"
```

Expected: release planning/evidence is committed without sweeping unrelated screenshots or temporary reports.

- [ ] **Step 3: Commit zh translations separately**

Review the translation diff:

```bash
git diff -- superset/translations/zh/LC_MESSAGES/messages.po
```

If the diff is release-intended, commit it separately:

```bash
git add superset/translations/zh/LC_MESSAGES/messages.po
git commit -m "chore(i18n): update zh translations for noway release"
```

Expected: translation changes are isolated from component and production-plan commits.

- [ ] **Step 4: Confirm publishable local state**

```bash
git status --short --branch
git log --oneline --decorate --max-count=12
```

Expected: no unexpected modified files. Remaining untracked files, if any, are intentionally excluded from production.

## Task 4: Production Preflight

**Files:**

- No code changes.

- [ ] **Step 1: Capture local provenance**

Run from repository root:

```bash
git status --short --branch
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git rev-list --left-right --count HEAD...fork/noway-release
```

Expected: branch is `noway-release`; commit hash is recorded; local ahead/behind state is known.

- [ ] **Step 2: Verify remote SSH and deployment directory**

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops \
  'printf "ssh-ok\n" && hostname && date -Is && test -d /home/ubuntu/superset-docker && printf "superset-docker-dir-ok\n"'
```

Expected: SSH succeeds and `/home/ubuntu/superset-docker` exists.

- [ ] **Step 3: Verify current production health**

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker compose ps'
ssh agentops 'curl -fsS http://127.0.0.1:8088/health'
curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health
```

Expected: compose service is running, server-local health returns `OK`, public health returns `OK`.

- [ ] **Step 4: Dry-run runtime drift**

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

Expected: output is reviewed before any real sync. Differences under `superset/static/assets` are expected after frontend build; unexpected Python/runtime differences require an explicit sync decision.

## Task 5: Build and Stage Production Assets

**Files:**

- Generated: `superset/static/assets/*`

- [ ] **Step 1: Build frontend assets**

Run from `superset-frontend`:

```bash
BABEL_ENV=testableProduction npm run build
```

Expected: build succeeds and updates `superset/static/assets`.

- [ ] **Step 2: Back up current remote assets**

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && bash -s' <<'REMOTE'
set -euo pipefail
ts="$(date +%Y%m%d%H%M%S)"
mkdir -p backups
cp -a superset-source/superset/static/assets "backups/assets-$ts"
printf 'assets_backup=%s\n' "backups/assets-$ts"
REMOTE
```

Expected: command prints a concrete `assets_backup=backups/assets-YYYYMMDDHHMMSS` path.

- [ ] **Step 3: Sync built assets**

```bash
rsync -az --delete \
  /Volumes/extend/ecode-workspace/superset-source/superset/static/assets/ \
  agentops:/home/ubuntu/superset-docker/superset-source/superset/static/assets/
```

Expected: remote assets match the local production build output.

## Task 6: Rebuild Image and Restart Production

**Files:**

- Remote Docker image: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- Remote compose service: `superset`

- [ ] **Step 1: Rebuild the production image**

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker build -f Dockerfile.doris-zh -t apache-superset-doris:6.0.0-zh-column-scheme-matrix .'
```

Expected: image build exits successfully.

- [ ] **Step 2: Recreate the Superset service**

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker compose up -d superset && docker ps --format "{{.Names}} {{.Status}}" | grep apache-superset'
```

Expected: `apache-superset` is running.

- [ ] **Step 3: Wait for Docker health**

```bash
ssh agentops 'for i in $(seq 1 24); do status="$(docker inspect -f "{{.State.Health.Status}}" apache-superset 2>/dev/null || true)"; printf "%s\n" "$status"; test "$status" = healthy && exit 0; sleep 5; done; exit 1'
```

Expected: command exits after printing `healthy`.

## Task 7: Production Verification and Closeout

**Files:**

- Create: `docs/superpowers/reports/2026-05-25-noway-release-production-closeout.md`

- [ ] **Step 1: Verify HTTP health**

```bash
ssh agentops 'curl -fsS http://127.0.0.1:8088/health'
curl -I --max-time 20 http://111.230.91.24:8088/
curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health
ssh agentops 'docker inspect -f "{{.Image}} {{.State.Status}} {{.State.Health.Status}}" apache-superset'
```

Expected: local and public health return `OK`; container status is running and healthy.

- [ ] **Step 2: Verify user-facing workflows**

Use an authenticated browser session against production and verify:

- Crosstab loads without missing visualization errors.
- Crosstab query returns rows on the accepted production dashboard or Explore slice.
- Noway Table V1 loads as an independent visualization.
- Column view scheme toolbar is visible and usable.
- zh translations appear where expected.
- Browser console has no new chunk-load or runtime exceptions for these workflows.

Expected: screenshots or browser notes are captured for crosstab and noway table v1.

- [ ] **Step 3: Record closeout report**

Create `docs/superpowers/reports/2026-05-25-noway-release-production-closeout.md` with:

```markdown
# Noway Release Production Closeout

## Local Source

- Branch:
- Commit:
- Release commits:

## Validation

- Scheme Jest:
- Crosstab Jest:
- TypeScript:
- Frontend build:

## Remote Deployment

- Host:
- Deployment root:
- Image tag:
- Image ID:
- Container health:
- Server-local health:
- Public health:
- Asset backup:

## Browser Acceptance

- Crosstab:
- Noway Table V1:
- zh translation:

## Verdict

- complete | partial | blocked
```

Expected: report separates local source, remote deployment, and browser evidence.

- [ ] **Step 4: Commit closeout report**

```bash
git add docs/superpowers/reports/2026-05-25-noway-release-production-closeout.md
git commit -m "docs(noway-release): record production closeout"
```

## Rollback Procedure

Use this only if production health or workflow verification fails after sync/restart.

- [ ] **Step 1: Restore the latest remote asset backup**

Replace `<backup-path>` with the `assets_backup` value printed in Task 5:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && rm -rf superset-source/superset/static/assets && cp -a <backup-path> superset-source/superset/static/assets'
```

Expected: remote assets are restored from the pre-release backup.

- [ ] **Step 2: Rebuild and restart using restored assets**

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker build -f Dockerfile.doris-zh -t apache-superset-doris:6.0.0-zh-column-scheme-matrix .'
ssh agentops 'cd /home/ubuntu/superset-docker && docker compose up -d superset'
```

Expected: old asset state is back inside the rebuilt image.

- [ ] **Step 3: Verify rollback health**

```bash
ssh agentops 'for i in $(seq 1 24); do status="$(docker inspect -f "{{.State.Health.Status}}" apache-superset 2>/dev/null || true)"; printf "%s\n" "$status"; test "$status" = healthy && exit 0; sleep 5; done; exit 1'
curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health
```

Expected: container health is `healthy` and public health returns `OK`.

