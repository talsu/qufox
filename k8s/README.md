# qufox on k3s (rpi-cluster)

라즈베리파이 k3s 클러스터(192.168.0.6) 배포 매니페스트. 데이터 계층
(postgres/redis/minio)은 NAS(192.168.0.71)의 기존 prod 인스턴스를 원격으로
사용하고, 여기서는 앱(api/web)만 구동한다.

## 구성

| 파일 | 내용 |
|---|---|
| `00-base.yaml` | 네임스페이스, NAS minio용 외부 Service/EndpointSlice, traefik StripPrefix 미들웨어 |
| `10-api.yaml` | api Deployment + Service (probe는 /healthz, /readyz) |
| `20-web.yaml` | web Deployment + Service |
| `30-ingress.yaml` | 내부 테스트 호스트(qufox.192.168.0.6.nip.io) 라우팅 |
| `40-public-hosts.yaml` | 공개 도메인(qufox.com, sso.qufox.com) 라우팅 — NAS nginx가 TLS 종료 후 프록시 |

트래픽 경로: 인터넷 → NAS nginx(TLS) → 파이 traefik → api/web 파드.
경로 규칙(/api, /socket.io, /attachments)은 NAS nginx의 기존 qufox.com
블록과 동일하게 재현되어 있다.

## 시크릿 (커밋 금지)

환경변수는 `qufox-env` Secret으로 주입한다. NAS의 `.env.prod`를 기반으로
클러스터용 값(DATABASE_URL은 NAS IP:15432, REDIS_URL/S3_ENDPOINT는 NAS IP)을
덮어써서 생성한다:

```bash
kubectl -n qufox create secret generic qufox-env --from-env-file=<가공한 env 파일>
```

## 최초 적용 순서

```bash
kubectl apply -f k8s/00-base.yaml
# qufox-env Secret 생성 (위 참조)
kubectl apply -f k8s/10-api.yaml -f k8s/20-web.yaml -f k8s/30-ingress.yaml -f k8s/40-public-hosts.yaml
```

이미지는 레지스트리를 쓰지 않고 파이에서 네이티브 빌드 후 containerd에
직접 import한다(`imagePullPolicy: Never`) — `scripts/deploy/deploy-k3s.sh` 참조.

전제 조건: 파이 traefik에 NAS발 X-Forwarded-Proto 신뢰 설정
(HelmChartConfig, 클러스터 관리 문서 참조)이 적용되어 있어야 한다.
