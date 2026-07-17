# Runbook — Deploy (k3s, 2026-07~)

2026-07 k3s 이관 이후의 prod 배포 절차. 앱(api/web)은 라즈베리파이 k3s
클러스터에서 돌고, 데이터 계층(Postgres/Redis/MinIO)과 TLS 관문(nginx)은
NAS에 남아 있다. 구 NAS 배포 경로는 `runbook-deploy.md`(역사 기록) 참조.

## 지형

| 무엇 | 어디 | 비고 |
|---|---|---|
| api/web 파드 | 파이 `rpi-cluster-0`(192.168.0.6), ns `qufox` | manifests: repo `k8s/` |
| 이미지 | `ghcr.io/talsu/qufox/{api,web}` (비공개) | `sha-<short>` + `latest` 태그 |
| Postgres/Redis/MinIO | NAS 192.168.0.71 :15432/:6379/:9000 | 기존 prod 인스턴스 그대로 |
| TLS/관문 | NAS nginx (호스트 10080/10443) | qufox.com·sso.qufox.com → 파이 traefik 프록시 |
| 시크릿 | ns qufox: `qufox-env`(앱 env), `ghcr-pull`(이미지 pull) | 생성법 `k8s/README.md` |

## 정상 배포 경로

파이에서 (어느 체크아웃에서든):

```bash
git pull
scripts/deploy/deploy-k3s.sh api    # 또는 web
```

스크립트가 하는 일: ① 네이티브 arm64 `docker build` ② ghcr push
(`sha-$(git rev-parse --short HEAD)` + `latest`) ③ `kubectl set image`
④ `rollout status` 게이트(180s) — readiness probe(`/readyz`)가 green이 될
때까지 구 파드가 트래픽을 계속 받는다 ⑤ 게이트 실패 시 자동 `rollout undo`.

전제: 빌드 머신에서 `sudo docker login ghcr.io -u talsu`(write:packages 토큰,
파이는 `~/.ghcr-token`에 보관) 1회.

### 태그만 교체하는 배포/롤백 (빌드 없이)

이미지가 이미 ghcr에 있으므로 어디서든:

```bash
kubectl -n qufox set image deploy/qufox-api api=ghcr.io/talsu/qufox/api:sha-XXXXXXXX
kubectl -n qufox rollout undo deploy/qufox-api        # 직전 릴리스로
```

Freelens에서도 동일: Deployment 편집으로 이미지 태그 변경. 쌓인 태그 목록은
github.com/talsu?tab=packages 에서 확인.

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
