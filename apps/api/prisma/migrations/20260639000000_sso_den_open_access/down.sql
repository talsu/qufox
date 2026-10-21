-- qufox-den openAccess 롤백 — metadata 에서 키만 지운다(허용목록 동작으로 복귀).

UPDATE "OAuthClient"
   SET "metadata" = "metadata" - 'openAccess',
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE "clientId" = 'qufox-den';
