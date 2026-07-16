#!/usr/bin/env bash
# Deploy a qufox service to the Pi k3s cluster.
#
# Flow: native arm64 docker build → `docker save | k3s ctr images import`
# (no registry — see infra/registry/compose.yml security notes for why the
# NAS registry stays loopback-only) → `kubectl set image` with a sha tag →
# rollout gate with automatic undo on failure.
#
# Run ON the Pi (rpi-cluster-0), from any checkout of this repo:
#   scripts/deploy/deploy-k3s.sh <api|web> [sha]
#     sha defaults to `git rev-parse --short HEAD`.
#
# Rollback to the previous release at any time:
#   kubectl -n qufox rollout undo deploy/qufox-<svc>
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"

SVC="${1:?usage: deploy-k3s.sh <api|web> [sha]}"
SHA="${2:-$(git rev-parse --short HEAD 2>/dev/null || echo manual)}"
case "$SVC" in
  api) DOCKERFILE=apps/api/Dockerfile ;;
  web) DOCKERFILE=apps/web/Dockerfile ;;
  *) echo "deploy-k3s.sh: unknown service '$SVC' (expected api|web)" >&2; exit 2 ;;
esac

IMAGE="qufox/$SVC"
TAG="sha-$SHA"
DEPLOY="qufox-$SVC"
NS=qufox
export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"

log() { printf '[deploy-k3s:%s] %s\n' "$SVC" "$*"; }

log "building $IMAGE:$TAG (native arm64)"
sudo docker build -f "$DOCKERFILE" -t "$IMAGE:$TAG" .

log "importing into k3s containerd"
sudo docker save "$IMAGE:$TAG" | sudo k3s ctr images import -

log "rolling out"
# 컨테이너 이름은 Deployment 안에서 api|web (k8s/10-api.yaml, 20-web.yaml)
kubectl -n "$NS" set image "deploy/$DEPLOY" "$SVC=$IMAGE:$TAG"

if ! kubectl -n "$NS" rollout status "deploy/$DEPLOY" --timeout=180s; then
  log "rollout FAILED — undoing to previous release"
  kubectl -n "$NS" rollout undo "deploy/$DEPLOY"
  kubectl -n "$NS" rollout status "deploy/$DEPLOY" --timeout=120s || true
  exit 1
fi

log "deployed $IMAGE:$TAG"
