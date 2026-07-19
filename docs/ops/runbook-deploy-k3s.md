# Runbook — Deploy (k3s, 2026-07~)

2026-07 k3s 이관 이후의 prod 배포 절차. 앱(api/web)은 라즈베리파이 k3s
클러스터에서 돌고, 데이터 계층(Postgres/Redis/MinIO)과 TLS 관문(nginx)은
NAS에 남아 있다. 구 NAS 배포 경로는 `runbook-deploy.md`(역사 기록) 참조.

## 지형

| 무엇                 | 어디                                                    | 비고                                          |
| -------------------- | ------------------------------------------------------- | --------------------------------------------- |
| api/web 파드         | 파이 `rpi-cluster-0`(192.168.0.6), ns `qufox`           | manifests: repo `k8s/`                        |
| 이미지               | `ghcr.io/talsu/qufox/{api,web}` (비공개)                | `sha-<short>` + `latest` 태그                 |
| Postgres/Redis/MinIO | NAS 192.168.0.71 :15432/:6379/:9000                     | 기존 prod 인스턴스 그대로                     |
| TLS/관문             | NAS nginx (호스트 10080/10443)                          | qufox.com·sso.qufox.com → 파이 traefik 프록시 |
| 시크릿               | ns qufox: `qufox-env`(앱 env), `ghcr-pull`(이미지 pull) | 생성법 `k8s/README.md`                        |

## 정상 배포 경로 (GitOps — push만 하면 끝)

main에 코드 push → 자동:

```
GitHub Actions(.github/workflows/deploy.yml)
  ├─ build(matrix): api·web × amd64@ubuntu-24.04 / arm64@ubuntu-24.04-arm  (네이티브, QEMU 없음)
  │    → ghcr.io/talsu/qufox/{api,web} 를 digest로 push
  ├─ merge-deploy: 서비스별 manifest list(:sha-<short>, :latest) 생성
  └─ merge-deploy: k8s/10-api.yaml·20-web.yaml 태그를 sha-<short>로 커밋([skip ci])
Flux(fleet repo talsu/lab-flux) → 이 repo k8s/ 를 sync → 롤아웃(readiness `/readyz` 게이트)
```

- **CI는 클러스터에 접근하지 않는다.** 실제 배포는 Flux가 git을 pull 해서 수행.
- `k8s/**`·문서만 바뀐 push는 재빌드 안 함(`paths-ignore` + `[skip ci]`, 루프 방지).
- 수동 재실행: `gh workflow run deploy.yml --repo talsu/qufox --ref main`.
- 전제: repo secret `GHCR_TOKEN`(write:packages PAT) — ghcr push용. k8s 태그 커밋은
  기본 `GITHUB_TOKEN`(contents:write)이 한다.

### 롤백 (git revert)

kubectl이 아니라 git으로 되돌린다 (Flux가 다음 reconcile에서 git 상태로 되돌리므로
`kubectl set image`/`rollout undo`는 GitOps와 충돌한다):

```bash
git revert <chore(k8s): deploy … 커밋> && git push   # → Flux가 이전 sha로 롤아웃
# 또는 k8s/10-api.yaml·20-web.yaml 의 태그를 원하는 sha-<short>로 직접 바꿔 커밋/push
```

쌓인 태그 목록은 github.com/talsu?tab=packages 에서 확인. 클러스터 상태 확인:
`flux get kustomization qufox` / `kubectl -n qufox get deploy`.

## 배포 중 관찰

```bash
kubectl -n qufox get pods -w                          # 파드 교체 과정
kubectl -n qufox logs deploy/qufox-api -f             # 새 파드 로그
while true; do curl -sk https://qufox.com/api/readyz | jq -c .; sleep 2; done
```

## 마이그레이션 주의

이미지 CMD에는 `prisma migrate deploy`가 없다(2026-06 runaway 재발 방지).
스키마 변경이 포함된 배포는 rollout 전에 파이에서 1회성으로 실행:

```bash
kubectl -n qufox run migrate --rm -it --restart=Never \
  --image=ghcr.io/talsu/qufox/api:sha-XXXXXXXX \
  --overrides='{"spec":{"imagePullSecrets":[{"name":"ghcr-pull"}]}}' \
  --env="$(kubectl -n qufox get secret qufox-env -o jsonpath='{.data.DATABASE_URL}' | base64 -d | xargs echo DATABASE_URL=)" \
  -- npx prisma migrate deploy
# 또는 단순하게: 아무 체크아웃에서 DATABASE_URL 지정 후 pnpm exec prisma migrate deploy
```

## 전면 롤백 (파이 → NAS 구 경로)

파이 클러스터 자체가 문제일 때. NAS에서:

```bash
cp /volume2/dockers/nginx/nginx.conf.bak.k3s-cutover-* /volume2/dockers/nginx/nginx.conf
sudo docker exec nginx-proxy-1 nginx -s reload
sudo docker start qufox-api qufox-web
```

qufox.com이 다시 NAS 컨테이너(중지 상태로 보존 중)로 서비스된다.

## 시크릿 로테이션 연동

`.env.prod` 값이 바뀌면 클러스터 Secret도 재생성해야 한다(`k8s/README.md`의
생성 절차 반복) 후 `kubectl -n qufox rollout restart deploy/qufox-api`.
ghcr 토큰 로테이션 시 갱신할 곳 3군데: 파이 `~/.ghcr-token`,
`sudo docker login`, `ghcr-pull` Secret 재생성.
