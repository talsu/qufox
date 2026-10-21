-- SSO client 별 허용목록 해제 — qufox-den 만 openAccess(2026-10-21 운영자 지시).
--
-- 스키마 변경 없음. OAuthClient.metadata(JSONB)에 "openAccess": true 를 더한다.
-- isApproved 가 이 표를 호출마다 읽어, 로그인한 모든 qufox 계정을 허용한다. 다른
-- client(stream/skulk/issue-hub 등)는 그대로 OAuthClientAccess 허용목록을 따른다.
-- qufox-den 행이 없는 환경(dev/test)에서는 0행 갱신(no-op). 멱등. down.sql 이 키를 지운다.

UPDATE "OAuthClient"
   SET "metadata" = "metadata" || '{"openAccess": true}'::jsonb,
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE "clientId" = 'qufox-den';
