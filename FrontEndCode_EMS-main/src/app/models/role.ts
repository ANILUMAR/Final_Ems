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

/** `EMPLOYEE` -> "Developer". Unknown values fall back to title-cased words. */
export function roleLabel(role?: string | null): string {
  const value = String(role || '').trim();
  if (!value) {
    return 'Unassigned';
  }
  const key = value.toUpperCase();
  const words = key.toLowerCase().split('_').filter((word) => !!word);
  return ROLE_LOOKUP[key]?.label
    || words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
    case LEGACY_ADMIN:
      return 'ADMIN';
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

/** A team leader of either team. */
export function isLeadRole(role?: string | null): boolean {
  const value = String(role || '').trim().toUpperCase();
  return value === 'TESTER_LEAD' || value === 'DEVELOPER_LEAD';
}

/** CEO or team leader: the people who read the whole register. */
export function isManagerRole(role?: string | null): boolean {
  return isSuperAdminRole(role) || isLeadRole(role);
}

/** A plain tester - the only role the two provisions can be handed to. */
export function isPlainTesterRole(role?: string | null): boolean {
  return String(role || '').trim().toUpperCase() === 'TESTER';
}

/**
 * Narrows a ROLE list to the codes a picker may offer, keeping its order. The
 * legacy ADMIN code is dropped: it means the same person as SUPER_ADMIN.
 */
export function assignableRoles(codes: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  return (codes || [])
    .map((code) => String(code || '').trim().toUpperCase())
    .filter((code) => {
      if (!code || code === LEGACY_ADMIN || seen.has(code)) {
        return false;
      }
      seen.add(code);
      return true;
    });
}
