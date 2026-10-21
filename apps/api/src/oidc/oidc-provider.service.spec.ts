// isApproved 단위 테스트 — SSO 관리자 / client openAccess / OAuthClientAccess 허용목록 분기.
// stub prisma 로 판정 로직만 검증한다(실제 DB·oidc-provider 불요).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OidcProviderService } from './oidc-provider.service';

type UserRow = { email: string; isDeactivated: boolean } | null;

function makeService(opts: {
  user: UserRow;
  metadata?: unknown;
  hasClient?: boolean;
  accessRow?: boolean;
}) {
  const prisma = {
    user: { findUnique: vi.fn(async () => opts.user) },
    oAuthClient: {
      findUnique: vi.fn(async () =>
        opts.hasClient === false ? null : { metadata: opts.metadata ?? {} },
      ),
    },
    oAuthClientAccess: {
      findUnique: vi.fn(async () => (opts.accessRow ? { id: 'a1' } : null)),
    },
  };
  const service = new OidcProviderService(
    {} as never,
    prisma as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}

const member = { email: 'someone@qufox.com', isDeactivated: false };

describe('OidcProviderService.isApproved', () => {
  const prevAdmins = process.env.SSO_ADMIN_EMAILS;
  beforeEach(() => {
    process.env.SSO_ADMIN_EMAILS = 'admin@qufox.com';
  });
  afterEach(() => {
    process.env.SSO_ADMIN_EMAILS = prevAdmins;
  });

  it('SSO 관리자는 허용목록 행 없이 허용', async () => {
    const { service, prisma } = makeService({
      user: { email: 'Admin@qufox.com', isDeactivated: false },
    });
    await expect(service.isApproved('skulk', 'u1')).resolves.toBe(true);
    expect(prisma.oAuthClientAccess.findUnique).not.toHaveBeenCalled();
  });

  it('openAccess client 는 허용목록 행 없이 활성 계정을 허용', async () => {
    const { service, prisma } = makeService({ user: member, metadata: { openAccess: true } });
    await expect(service.isApproved('qufox-den', 'u1')).resolves.toBe(true);
    expect(prisma.oAuthClientAccess.findUnique).not.toHaveBeenCalled();
  });

  it('openAccess client 라도 비활성 계정은 허용목록으로 판정', async () => {
    const { service } = makeService({
      user: { ...member, isDeactivated: true },
      metadata: { openAccess: true },
    });
    await expect(service.isApproved('qufox-den', 'u1')).resolves.toBe(false);
  });

  it('openAccess client 라도 계정이 없으면 거부', async () => {
    const { service } = makeService({ user: null, metadata: { openAccess: true } });
    await expect(service.isApproved('qufox-den', 'u1')).resolves.toBe(false);
  });

  it.each([[{}], [{ openAccess: 'true' }], [{ openAccess: 1 }], [null], [['openAccess']]])(
    'openAccess 가 정확히 true 가 아니면(%j) 허용목록 행이 필요',
    async (metadata) => {
      const { service } = makeService({ user: member, metadata });
      await expect(service.isApproved('skulk', 'u1')).resolves.toBe(false);
    },
  );

  it('허용목록 행이 있으면 허용', async () => {
    const { service, prisma } = makeService({ user: member, accessRow: true });
    await expect(service.isApproved('skulk', 'u1')).resolves.toBe(true);
    expect(prisma.oAuthClientAccess.findUnique).toHaveBeenCalledWith({
      where: { clientId_userId: { clientId: 'skulk', userId: 'u1' } },
    });
  });

  it('등록되지 않은 client 는 허용목록 행으로만 판정', async () => {
    const { service } = makeService({ user: member, hasClient: false });
    await expect(service.isApproved('unknown', 'u1')).resolves.toBe(false);
  });
});
