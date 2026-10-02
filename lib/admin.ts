// Shapes and helpers for the /admin console. The data comes from the
// admin_overview() RPC in supabase/admin.sql, which returns snake_case rows.

export interface AdminAccount {
  id: string;
  email: string | null;
  joinedAt: string;
  lastSignInAt: string | null;
  buildingCount: number;
  isAdmin: boolean;
}

export interface AdminBuilding {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string | null;
  floors: number;
  rooms: number;
  exits: number;
  updatedAt: string;
}

export interface AdminOverview {
  accounts: AdminAccount[];
  buildings: AdminBuilding[];
}

interface RawAccount {
  id: string;
  email: string | null;
  joined_at: string;
  last_sign_in_at: string | null;
  building_count: number | null;
  is_admin: boolean | null;
}

interface RawBuilding {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string | null;
  floors: number | null;
  rooms: number | null;
  exits: number | null;
  updated_at: string;
}

export function parseAdminOverview(raw: unknown): AdminOverview {
  const data = (raw ?? {}) as { accounts?: RawAccount[] | null; buildings?: RawBuilding[] | null };
  return {
    accounts: (data.accounts ?? []).map((a) => ({
      id: a.id,
      email: a.email,
      joinedAt: a.joined_at,
      lastSignInAt: a.last_sign_in_at,
      buildingCount: a.building_count ?? 0,
      isAdmin: a.is_admin ?? false,
    })),
    buildings: (data.buildings ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      ownerId: b.owner_id,
      ownerEmail: b.owner_email,
      floors: b.floors ?? 0,
      rooms: b.rooms ?? 0,
      exits: b.exits ?? 0,
      updatedAt: b.updated_at,
    })),
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function adminStats(overview: AdminOverview, now = Date.now()) {
  return {
    accounts: overview.accounts.length,
    newThisWeek: overview.accounts.filter((a) => now - new Date(a.joinedAt).getTime() <= WEEK_MS).length,
    buildings: overview.buildings.length,
    admins: overview.accounts.filter((a) => a.isAdmin).length,
  };
}

/** Case-insensitive match on email (accounts) or name/owner email (buildings). */
export function filterAccounts(accounts: AdminAccount[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return accounts;
  return accounts.filter((a) => (a.email ?? '').toLowerCase().includes(q));
}

export function filterBuildings(buildings: AdminBuilding[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return buildings;
  return buildings.filter((b) => b.name.toLowerCase().includes(q) || (b.ownerEmail ?? '').toLowerCase().includes(q));
}
