import { describe, expect, it } from 'vitest';
import { adminStats, filterAccounts, filterBuildings, parseAdminOverview } from './admin';

const now = new Date('2026-10-01T12:00:00Z').getTime();

const raw = {
  accounts: [
    { id: 'u1', email: 'owner@example.com', joined_at: '2026-01-01T00:00:00Z', last_sign_in_at: '2026-09-30T00:00:00Z', building_count: 2, is_admin: true },
    { id: 'u2', email: 'New.User@example.com', joined_at: '2026-09-28T00:00:00Z', last_sign_in_at: null, building_count: null, is_admin: false },
  ],
  buildings: [
    { id: 'b1', name: 'Riverside Office', owner_id: 'u1', owner_email: 'owner@example.com', floors: 2, rooms: 10, exits: 3, updated_at: '2026-09-30T00:00:00Z' },
    { id: 'b2', name: 'Warehouse', owner_id: 'u2', owner_email: null, floors: null, rooms: null, exits: null, updated_at: '2026-09-29T00:00:00Z' },
  ],
};

describe('parseAdminOverview', () => {
  it('maps snake_case rows and fills missing counts', () => {
    const o = parseAdminOverview(raw);
    expect(o.accounts[1]).toEqual({ id: 'u2', email: 'New.User@example.com', joinedAt: '2026-09-28T00:00:00Z', lastSignInAt: null, buildingCount: 0, isAdmin: false });
    expect(o.buildings[1]).toMatchObject({ ownerEmail: null, floors: 0, rooms: 0, exits: 0 });
  });

  it('treats null lists as empty', () => {
    expect(parseAdminOverview({ accounts: null, buildings: null })).toEqual({ accounts: [], buildings: [] });
    expect(parseAdminOverview(null)).toEqual({ accounts: [], buildings: [] });
  });
});

describe('adminStats', () => {
  it('counts accounts, sign-ups in the last 7 days, buildings and admins', () => {
    expect(adminStats(parseAdminOverview(raw), now)).toEqual({ accounts: 2, newThisWeek: 1, buildings: 2, admins: 1 });
  });
});

describe('filters', () => {
  const o = parseAdminOverview(raw);
  it('matches account email case-insensitively', () => {
    expect(filterAccounts(o.accounts, 'new.user').map((a) => a.id)).toEqual(['u2']);
    expect(filterAccounts(o.accounts, '  ')).toHaveLength(2);
  });
  it('matches building name or owner email', () => {
    expect(filterBuildings(o.buildings, 'ware').map((b) => b.id)).toEqual(['b2']);
    expect(filterBuildings(o.buildings, 'OWNER@').map((b) => b.id)).toEqual(['b1']);
  });
});
