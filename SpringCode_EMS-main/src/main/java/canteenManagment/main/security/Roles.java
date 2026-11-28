package canteenManagment.main.security;

import java.util.List;
import java.util.Locale;

/**
 * The five identities a person can hold, and the family each one belongs to.
 *
 * <p>A role answers two different questions, so it is stored once and read in
 * two ways. <em>What am I</em> is the code on the account; it decides the
 * landing page, the sidebar and the wording. <em>Which part of the workspace is
 * mine</em> is the family; it is the coarse gate the security rules were
 * written against, which is why adding an identity never means rewriting
 * {@code SecurityConfig}.</p>
 *
 * <pre>
 * SUPER_ADMIN     family ADMIN     the CEO: everything, accounts and audit too
 * DEVELOPER_LEAD  family EMPLOYEE  runs the developers' work
 * EMPLOYEE        family EMPLOYEE  developer; own queue only
 * TESTER_LEAD     family TESTER    runs the testers' work
 * TESTER          family TESTER    tester; own queue only
 * </pre>
 *
 * <p>{@code ADMIN} is the name this product used for the CEO before the team
 * leaders existed. Rows that still carry it keep signing in (it maps to
 * {@link #SUPER_ADMIN}) and are rewritten at start-up; it is never handed out
 * to a new account again.</p>
 */
public final class Roles {

    public static final String SUPER_ADMIN = "SUPER_ADMIN";
    public static final String PROJECT_MANAGER = "PROJECT_MANAGER";
    public static final String TEAM_LEAD = "TEAM_LEAD";
    public static final String DEVELOPER_LEAD = "DEVELOPER_LEAD";
    public static final String EMPLOYEE = "EMPLOYEE";
    public static final String TESTER_LEAD = "TESTER_LEAD";
    public static final String TESTER = "TESTER";

    /** Pre-split code for the CEO: recognised, never offered. */
    public static final String LEGACY_ADMIN = "ADMIN";
    /** Alias for TEAM_LEAD: recognised, normalised. */
    public static final String LEGACY_TEAM_LEADER = "TEAM_LEADER";

    public static final String FAMILY_ADMIN = "ADMIN";
    public static final String FAMILY_DEVELOPER = "EMPLOYEE";
    public static final String FAMILY_TESTER = "TESTER";

    /**
     * The order the role dropdown shows: the CEO first, then project managers,
     * then team leaders, then each team with its leader above its members.
     * Note: DEVELOPER_LEAD is unified into TEAM_LEAD ("Team Leader") for the frontend development team.
     */
    public static final List<String> ASSIGNABLE =
            List.of(SUPER_ADMIN, PROJECT_MANAGER, TEAM_LEAD, EMPLOYEE, TESTER_LEAD, TESTER);

    private Roles() {
    }

    /** The stored value, trimmed and upper-cased, without changing its meaning. */
    public static String raw(String role) {
        return role == null ? "" : role.trim().toUpperCase(Locale.ROOT);
    }

    /** True for a value this product understands, including legacy codes. */
    public static boolean isKnown(String role) {
        String value = raw(role);
        return LEGACY_ADMIN.equals(value) || LEGACY_TEAM_LEADER.equals(value) || DEVELOPER_LEAD.equals(value) || ASSIGNABLE.contains(value);
    }

    /** True for a value a new account may be given. */
    public static boolean isAssignable(String role) {
        return ASSIGNABLE.contains(raw(role));
    }

    /**
     * The value to store. An empty or unknown role becomes a developer - the
     * least privileged family - rather than being written through unchecked.
     */
    public static String normalise(String role) {
        String value = raw(role);
        if (LEGACY_ADMIN.equals(value)) {
            return SUPER_ADMIN;
        }
        if (LEGACY_TEAM_LEADER.equals(value) || DEVELOPER_LEAD.equals(value)) {
            return TEAM_LEAD;
        }
        return ASSIGNABLE.contains(value) ? value : EMPLOYEE;
    }

    public static boolean isSuperAdmin(String role) {
        String value = raw(role);
        return SUPER_ADMIN.equals(value) || LEGACY_ADMIN.equals(value);
    }

    public static boolean isTeamLead(String role) {
        String value = raw(role);
        return TEAM_LEAD.equals(value) || LEGACY_TEAM_LEADER.equals(value) || DEVELOPER_LEAD.equals(value);
    }

    public static boolean isDeveloperLead(String role) {
        return isTeamLead(role);
    }

    public static boolean isTesterLead(String role) {
        return TESTER_LEAD.equals(raw(role));
    }

    /** A team leader of any team (general Team Leader, Dev Lead, or QA Lead). */
    public static boolean isLead(String role) {
        return isTeamLead(role) || isDeveloperLead(role) || isTesterLead(role);
    }

    /**
     * {@code ADMIN}, {@code EMPLOYEE} or {@code TESTER}; empty for a value that
     * is not one of the identities, so nothing is granted by accident.
     */
    public static String family(String role) {
        switch (raw(role)) {
            case SUPER_ADMIN:
            case LEGACY_ADMIN:
            case PROJECT_MANAGER:
                return FAMILY_ADMIN;
            case TEAM_LEAD:
            case LEGACY_TEAM_LEADER:
            case DEVELOPER_LEAD:
            case EMPLOYEE:
                return FAMILY_DEVELOPER;
            case TESTER_LEAD:
            case TESTER:
                return FAMILY_TESTER;
            default:
                return "";
        }
    }
}
