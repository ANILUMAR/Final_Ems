package canteenManagment.main.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

/**
 * Central place for the role checks used by the controllers.
 *
 * <p>Five identities exist in the product (see {@link Roles}). Each one signs in
 * with two authorities: its own code and the family it belongs to. So</p>
 *
 * <pre>
 * SUPER_ADMIN     ROLE_SUPER_ADMIN, ROLE_ADMIN
 * DEVELOPER_LEAD  ROLE_DEVELOPER_LEAD, ROLE_EMPLOYEE
 * EMPLOYEE        ROLE_EMPLOYEE
 * TESTER_LEAD     ROLE_TESTER_LEAD, ROLE_TESTER
 * TESTER          ROLE_TESTER
 * </pre>
 *
 * <p>The family authority is what makes the old rules keep working: every
 * {@code hasRole("ADMIN")} in {@code SecurityConfig} still means "the CEO", and
 * a team leader passes the tester/developer gates their own team passes. The
 * code authority is what separates the leader from the members.</p>
 */
public final class AuthContext {

    public static final String ROLE_ADMIN = "ROLE_ADMIN";
    public static final String ROLE_EMPLOYEE = "ROLE_EMPLOYEE";
    public static final String ROLE_TESTER = "ROLE_TESTER";
    public static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";
    public static final String ROLE_DEVELOPER_LEAD = "ROLE_DEVELOPER_LEAD";
    public static final String ROLE_TESTER_LEAD = "ROLE_TESTER_LEAD";

    private AuthContext() {
    }

    public static boolean hasRole(Authentication authentication, String role) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(role::equals);
    }

    /** The CEO: the whole workspace, accounts and the deletion audit included. */
    public static boolean isSuperAdmin(Authentication authentication) {
        return hasRole(authentication, ROLE_SUPER_ADMIN) || hasRole(authentication, ROLE_ADMIN);
    }

    /**
     * Kept for the existing call sites: every rule that used to say "admin"
     * means the CEO, and a team leader is deliberately not one - a leader runs
     * their team's work, they do not administer accounts.
     */
    public static boolean isAdmin(Authentication authentication) {
        return isSuperAdmin(authentication);
    }

    /** A team leader of either team, whichever one it is. */
    public static boolean isLead(Authentication authentication) {
        return hasRole(authentication, ROLE_TESTER_LEAD) || hasRole(authentication, ROLE_DEVELOPER_LEAD);
    }

    /**
     * Super admin or team leader: the people who read the whole register rather
     * than only the rows addressed to them.
     */
    public static boolean isManager(Authentication authentication) {
        return isSuperAdmin(authentication) || isLead(authentication);
    }

    /** Email (the JWT subject) of the caller, lowercased for comparisons. */
    public static String email(Authentication authentication) {
        return authentication == null ? "" : String.valueOf(authentication.getName()).toLowerCase();
    }
}
