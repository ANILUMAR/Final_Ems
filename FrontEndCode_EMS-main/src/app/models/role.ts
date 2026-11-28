/**
 * Display names, colours and the role vocabulary the screens branch on.
 *
 * The words are not hard-coded: `ReferenceService` fills them from the `ROLE`
 * rows of `app_lookup` during bootstrap, so renaming "Developer" in the
 * database renames it in the header, the table, the edit dialog and the profile
 * page at once.
 *
 * The codes are the five identities the guards compare, mirroring
 * `security/Roles.java` on the server:
 *
 *   SUPER_ADMIN     the CEO - family ADMIN
 *   DEVELOPER_LEAD  family EMPLOYEE
 *   EMPLOYEE        a developer - family EMPLOYEE
 *   TESTER_LEAD     family TESTER
 *   TESTER          family TESTER
 *
 * `ADMIN` is the name the CEO used before the team leaders existed: it still
 * renders (old rows carry it) but is never offered again.
 */
interface RoleLookup {
  label: string;
  tone: string;
}

export type RoleFamily = 'ADMIN' | 'EMPLOYEE' | 'TESTER';

/** Pre-split code for the CEO. Readable, never offered. */
export const LEGACY_ADMIN = 'ADMIN';

let ROLE_LOOKUP: Record<string, RoleLookup> = {};

/** Called by ReferenceService whenever the ROLE list is (re)loaded. */
export function applyRoleLookups(items: { code: string; label?: string; tone?: string | null }[]): void {
  const next: Record<string, RoleLookup> = {};
  (items || []).forEach((item) => {
    const key = String(item.code || '').toUpperCase();
    if (!key) {
      return;
    }
    next[key] = { label: item.label || key, tone: item.tone || 'neutral' };
  });
  ROLE_LOOKUP = next;
}

/** `EMPLOYEE` -> "Software Developer". Unknown values fall back to standardized titles. */
export function roleLabel(role?: string | null): string {
  const value = String(role || '').trim();
  if (!value) {
    return 'Unassigned';
  }
  const key = value.toUpperCase();
  if (ROLE_LOOKUP[key]?.label) {
    return ROLE_LOOKUP[key].label;
  }
  const defaults: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Super Admin',
    PROJECT_MANAGER: 'Project Manager',
    TEAM_LEAD: 'Team Leader',
    TEAM_LEADER: 'Team Leader',
    DEVELOPER_LEAD: 'Team Leader',
    EMPLOYEE: 'Software Developer',
    TESTER_LEAD: 'QA Team Lead',
    TESTER: 'QA Engineer'
  };
  if (defaults[key]) {
    return defaults[key];
  }
  const words = key.toLowerCase().split('_').filter((word) => !!word);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/** Admins read amber, everyone else neutral by default - the tone comes from the row. */
export function roleBadgeClass(role?: string | null): string {
  const value = String(role || '').trim().toUpperCase();
  if (!value) {
    return 'ems-badge--neutral';
  }
  return `ems-badge--${ROLE_LOOKUP[value]?.tone || 'neutral'}`;
}

/**
 * The broad group a role belongs to. The older screens were written against
 * three groups, so they keep working while the identities multiply.
 */
export function roleFamily(role?: string | null): RoleFamily | '' {
  switch (String(role || '').trim().toUpperCase()) {
    case 'SUPER_ADMIN':
    case 'PROJECT_MANAGER':
    case LEGACY_ADMIN:
      return 'ADMIN';
    case 'TEAM_LEAD':
    case 'TEAM_LEADER':
    case 'DEVELOPER_LEAD':
    case 'EMPLOYEE':
      return 'EMPLOYEE';
    case 'TESTER_LEAD':
    case 'TESTER':
      return 'TESTER';
    default:
      return '';
  }
}

/** The CEO: accounts, projects, the deletion audit - the whole workspace. */
export function isSuperAdminRole(role?: string | null): boolean {
  const value = String(role || '').trim().toUpperCase();
  return value === 'SUPER_ADMIN' || value === LEGACY_ADMIN;
}

/** A team leader of any team (general Team Leader, Dev Lead, QA Lead). */
export function isLeadRole(role?: string | null): boolean {
  const value = String(role || '').trim().toUpperCase();
  return (
    value === 'TESTER_LEAD' ||
    value === 'DEVELOPER_LEAD' ||
    value === 'TEAM_LEAD' ||
    value === 'TEAM_LEADER'
  );
}

/** Project Manager: oversees project leads and cross-project allocations. */
export function isProjectManagerRole(role?: string | null): boolean {
  return String(role || '').trim().toUpperCase() === 'PROJECT_MANAGER';
}

/** CEO, Project Manager or team leader: the people who run the workspace or teams. */
export function isManagerRole(role?: string | null): boolean {
  return isSuperAdminRole(role) || isProjectManagerRole(role) || isLeadRole(role);
}

/** A plain tester - the only role the two provisions can be handed to. */
export function isPlainTesterRole(role?: string | null): boolean {
  return String(role || '').trim().toUpperCase() === 'TESTER';
}

/** Normalizes any role representation (e.g. legacy ADMIN -> SUPER_ADMIN, DEVELOPER_LEAD -> TEAM_LEAD). */
export function normalizeRole(role?: string | null): string {
  const r = String(role || '').trim().toUpperCase();
  if (r === 'ADMIN') return 'SUPER_ADMIN';
  if (r === 'TEAM_LEADER' || r === 'DEVELOPER_LEAD') return 'TEAM_LEAD';
  return r;
}

/**
 * Narrows a ROLE list to the codes a picker may offer, keeping its order. The
 * legacy ADMIN code is dropped (maps to SUPER_ADMIN) and DEVELOPER_LEAD is unified
 * into TEAM_LEAD ("Team Leader") for the frontend development team.
 */
export function assignableRoles(codes: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  return (codes || [])
    .map((code) => {
      const c = String(code || '').trim().toUpperCase();
      if (c === 'DEVELOPER_LEAD' || c === 'TEAM_LEADER') return 'TEAM_LEAD';
      if (c === LEGACY_ADMIN) return 'SUPER_ADMIN';
      return c;
    })
    .filter((code) => {
      if (!code || code === LEGACY_ADMIN || seen.has(code)) {
        return false;
      }
      seen.add(code);
      return true;
    });
}
