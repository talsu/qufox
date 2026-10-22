-- qufox-den 은퇴 롤백 — metadata.retired 에서 허용목록 행과 openAccess 를 되살리고 다시 켠다.
-- 그 사이 하드삭제된 계정의 행은 건너뛴다(userId FK). 적용 후 qufox-api 재시작 필요(부팅 캐시).

INSERT INTO "OAuthClientAccess" ("id", "clientId", "userId", "createdAt", "createdBy")
SELECT (e ->> 'id')::uuid,
       'qufox-den',
       (e ->> 'userId')::uuid,
       (e ->> 'createdAt')::timestamp(3),
       (e ->> 'createdBy')::uuid
  FROM "OAuthClient" c,
       jsonb_array_elements(c."metadata" -> 'retired' -> 'access') e
 WHERE c."clientId" = 'qufox-den'
   AND EXISTS (SELECT 1 FROM "User" u WHERE u."id" = (e ->> 'userId')::uuid)
ON CONFLICT ("clientId", "userId") DO NOTHING;

UPDATE "OAuthClient" c
   SET "enabled" = true,
       "metadata" = (c."metadata" - 'retired') || CASE
         WHEN jsonb_typeof(c."metadata" -> 'retired' -> 'openAccess') IS NULL
           OR jsonb_typeof(c."metadata" -> 'retired' -> 'openAccess') = 'null' THEN '{}'::jsonb
         ELSE jsonb_build_object('openAccess', c."metadata" -> 'retired' -> 'openAccess')
       END,
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE c."clientId" = 'qufox-den'
   AND c."metadata" ? 'retired';
