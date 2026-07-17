#!/usr/bin/env bash
# Deploy a qufox service to the Pi k3s cluster via ghcr.io.
#
# Flow: native arm64 docker build → push to ghcr.io (private packages) →
# `kubectl set image` with a sha tag → rollout gate with automatic undo on
# failure. The cluster pulls with the `ghcr-pull` imagePullSecret
# (namespace qufox), so step (b) — pointing the Deployment at a tag — can
# also be done from Freelens/kubectl anywhere; this script just bundles
# build+push+rollout for one-command deploys.
#
# Prereqs (once per build machine):
#   sudo docker login ghcr.io -u talsu   # token with write:packages
#
# Run from any checkout, on a machine that can build arm64 (the Pi builds
# natively; elsewhere use buildx --platform linux/arm64):
#   scripts/deploy/deploy-k3s.sh <api|web> [sha]
#     sha defaults to `git rev-parse --short HEAD`.
#
# Rollback: kubectl -n qufox rollout undo deploy/qufox-<svc>
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

IMAGE="ghcr.io/talsu/qufox/$SVC"
TAG="sha-$SHA"
DEPLOY="qufox-$SVC"
NS=qufox
export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"

log() { printf '[deploy-k3s:%s] %s\n' "$SVC" "$*"; }

log "building $IMAGE:$TAG (arm64)"
sudo docker build -f "$DOCKERFILE" -t "$IMAGE:$TAG" -t "$IMAGE:latest" .

log "pushing to ghcr.io"
sudo docker push "$IMAGE:$TAG"
sudo docker push "$IMAGE:latest"

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
