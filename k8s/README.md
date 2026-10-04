# qufox on k3s (rpi-cluster)

라즈베리파이 k3s 클러스터(192.168.0.6) 배포 매니페스트. 데이터 계층
(postgres/redis/minio)은 NAS(192.168.0.71)의 기존 prod 인스턴스를 원격으로
사용하고, 여기서는 앱(api/web)만 구동한다.

## 구성

| 파일                   | 내용                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `00-base.yaml`         | 네임스페이스, NAS minio용 외부 Service/EndpointSlice, traefik StripPrefix 미들웨어 |
| `10-api.yaml`          | api Deployment + Service (probe는 /healthz, /readyz)                               |
| `20-web.yaml`          | web Deployment + Service                                                           |
| `30-ingress.yaml`      | 내부 테스트 호스트(qufox.192.168.0.6.nip.io) 라우팅                                |
| `40-public-hosts.yaml` | 공개 도메인(qufox.com, sso.qufox.com) 라우팅 — NAS nginx가 TLS 종료 후 프록시      |

트래픽 경로: 인터넷 → NAS nginx(TLS) → 파이 traefik → api/web 파드.
경로 규칙(/api, /socket.io, /attachments)은 NAS nginx의 기존 qufox.com
블록과 동일하게 재현되어 있다.

## 시크릿 (커밋 금지)

환경변수는 `qufox-env` Secret으로 주입한다. NAS의 `.env.prod`를 기반으로
클러스터용 값을 덮어써서 생성한다. 재생성 시 반드시 포함할 덮어쓰기:
`DATABASE_URL`(NAS IP:15432) · `REDIS_URL`/`S3_ENDPOINT`(NAS IP) ·
`NODE_ENV`/`API_PORT` · `OTEL_METRICS_EXPORTER=none`(수집기가 없어
localhost:4318 접속 에러가 로그를 채우는 것 방지):

```bash
kubectl -n qufox create secret generic qufox-env --from-env-file=<가공한 env 파일>
```

## 최초 적용 순서

```bash
kubectl apply -f k8s/00-base.yaml
# qufox-env Secret 생성 (위 참조)
kubectl apply -f k8s/10-api.yaml -f k8s/20-web.yaml -f k8s/30-ingress.yaml -f k8s/40-public-hosts.yaml
```

이미지는 `ghcr.io/talsu/qufox/{api,web}` 비공개 패키지에서 pull한다
(`ghcr-pull` imagePullSecret 필요 — read:packages 토큰으로 생성):

```bash
kubectl -n qufox create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io --docker-username=talsu --docker-password=<토큰>
```

빌드/배포는 GitOps(GitHub Actions + Flux)다: main에 push → `.github/workflows/deploy.yml`
이 api·web 멀티아키 이미지를 빌드/푸시하고 여기 `k8s/` 태그를 커밋 → Flux가 롤아웃.
상세·롤백 절차는 `docs/ops/runbook-deploy-k3s.md` 참조.

전제 조건: 파이 traefik에 NAS발 X-Forwarded-Proto 신뢰 설정
(HelmChartConfig, 클러스터 관리 문서 참조)이 적용되어 있어야 한다.

## Oracle Cloud 임시 운영 (2026-10 이사 기간)

홈랩이 이사하는 동안 `deploy/oracle/`의 overlay로 Oracle Cloud 서버의 k3s에서 돌립니다
(`kubectl --context oracle apply -k deploy/oracle`). 베이스는 이 폴더이고(그래서 `kustomization.yaml`로
파일 목록을 둠. Flux 동작은 같음), 차이는 데이터 계층뿐입니다: Postgres는 issue-hub overlay의 파드(DB `qufox`),
Redis와 객체 저장소는 파드로, `nas-minio` Service는 그 파드를 가리킵니다. MinIO 공개 이미지가 2026-10에
사라져 객체 저장소는 MinIO 호환 RustFS입니다(루트 키 = 앱의 S3 키, 시크릿 `objstore`). 첨부 버킷은
rclone 파드가 NAS MinIO에서 S3 API로 복사합니다. 시크릿(`qufox-env`, `objstore`, `ghcr-pull`)은 손으로
만들며 값은 어디에도 적지 않습니다. 전체 계획은 homelab-kb `wiki/relocation-2026-10.md`.
