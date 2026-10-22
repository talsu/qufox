-- SSO client qufox-den 은퇴 — Den 이 자체 계정으로 옮겨 qufox 로그인 연동을 걷어냈다
-- (2026-10-22 운영자 승인, qufox-den docs/tasks/054-qufox-sso-client-retire.md).
--
-- 스키마 변경 없음. 행을 지우지 않고 끈다(enabled=false) — loadClients 가 enabled 만 읽으므로
-- 부팅 후 provider 에서 빠지고, isApproved 의 openAccess 분기도 enabled 를 요구한다.
-- 되돌릴 수 있게 지우는 값을 metadata.retired 에 담는다: 빼는 openAccess 값과
-- OAuthClientAccess 행(id/userId/createdAt/createdBy) 전부. 그 뒤 허용목록 행을 지운다.
-- qufox-den 행이 없는 환경(dev/test)에서는 0행(no-op). retired 가 이미 있으면 덮지 않는다.
-- ★ client 목록은 부팅 캐시 — 적용 후 qufox-api 재시작(롤아웃)이 있어야 provider 에서 빠진다.
-- down.sql 이 retired 에서 행과 openAccess 를 되살리고 다시 켠다.

UPDATE "OAuthClient" c
   SET "enabled" = false,
       "metadata" = (c."metadata" - 'openAccess') || jsonb_build_object(
         'retired', jsonb_build_object(
           'at', to_jsonb(CURRENT_TIMESTAMP),
           'reason', 'qufox-den 자체 계정 전환(054)',
           'openAccess', c."metadata" -> 'openAccess',
           'access', COALESCE(
             (SELECT jsonb_agg(jsonb_build_object(
                       'id', a."id",
                       'userId', a."userId",
                       'createdAt', a."createdAt",
                       'createdBy', a."createdBy") ORDER BY a."createdAt")
                FROM "OAuthClientAccess" a
               WHERE a."clientId" = 'qufox-den'),
             '[]'::jsonb))),
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE c."clientId" = 'qufox-den'
   AND NOT (c."metadata" ? 'retired');

DELETE FROM "OAuthClientAccess" WHERE "clientId" = 'qufox-den';
