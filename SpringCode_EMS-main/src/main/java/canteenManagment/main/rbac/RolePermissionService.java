package canteenManagment.main.rbac;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import canteenManagment.main.security.Roles;

@Service
public class RolePermissionService {

    private static final Logger log = LoggerFactory.getLogger(RolePermissionService.class);

    private final RolePermissionRepository repository;

    /** Master catalogue of all system screens available in the application */
    private static final List<ScreenDefinition> SYSTEM_SCREENS = List.of(
            // Overview Group
            new ScreenDefinition("DASHBOARD", "Executive Dashboard", "/dashboard", "Overview", "space_dashboard", "Comprehensive analytics, stats, and operational performance summary", 10),
            new ScreenDefinition("DEVELOPER_BOARD", "Development Board", "/developer-board", "Overview", "code", "Developer team task board and active development pipeline", 20),
            new ScreenDefinition("TESTER_BOARD", "QA Testing Board", "/tester-board", "Overview", "bug_report", "QA testing dashboard and verification pipeline", 30),
            new ScreenDefinition("TESTING_LEAD_DASHBOARD", "QA Lead Dashboard", "/testing-lead-dashboard", "Overview", "rule", "Team workload, released task verification, and tester triage management", 40),

            // Work Group
            new ScreenDefinition("RAISE_TICKET", "Create Issue", "/issues/new", "Work", "add_circle", "Submit new task or bug with reproduction flow, steps, and expected behavior", 50),
            new ScreenDefinition("MY_SUBMISSIONS", "My Reported Issues", "/my-submissions", "Work", "fact_check", "Track personal submissions, review status, and lead feedback", 60),
            new ScreenDefinition("TICKET_HUB", "Ticket Hub", "/tasks/all", "Work", "view_quilt", "Unified console for ticket review, assignment, dev completed, and on-hold", 70),
            new ScreenDefinition("TESTING_REVIEW", "QA Bug Triage", "/approvals", "Work", "approval", "Review and triage tickets submitted by testers before developer release", 80),
            new ScreenDefinition("DEV_TEAM_ASSIGNMENT", "Work Allocation", "/triage", "Work", "assignment_ind", "Assign approved tickets to developers with priority and delivery dates", 90),
            new ScreenDefinition("DEV_COMPLETED_TICKETS", "Pending QA Release", "/developer-completed", "Work", "inventory_2", "View developer-completed tickets and release them for QA verification", 100),
            new ScreenDefinition("ON_HOLD_TICKETS", "On-Hold Tickets", "/on-hold-tasks", "Work", "pause_circle_outline", "Review tickets placed on hold with reasons and resume them", 110),
            new ScreenDefinition("TESTED_COMPLETED_REVIEW", "QA Verification Sign-off", "/tested-completed", "Work", "verified", "Lead review of tasks tested and verified by QA team", 120),
            new ScreenDefinition("MY_TICKETS", "My Assigned Tickets", "/my-tasks", "Work", "task_alt", "Personal open tickets and bug queue with direct status updates", 130),
            new ScreenDefinition("MY_COMPLETED_TICKETS_DEV", "My Completed Work (Dev)", "/developer-completed", "Work", "check_circle", "Personal completed development tasks", 140),
            new ScreenDefinition("MY_COMPLETED_TICKETS_QA", "My Completed Work (QA)", "/tester-completed", "Work", "fact_check", "Personal QA verified and completed tasks", 150),
            new ScreenDefinition("TICKET_BOARD", "Kanban Board", "/tasks", "Work", "view_kanban", "Full-screen Kanban board and swimlanes for project tickets", 160),
            new ScreenDefinition("ALL_TICKETS", "All Tickets Registry", "/tasks/all", "Work", "list_alt", "Global registry of all project tickets and bugs with CSV download", 170),
            new ScreenDefinition("MODULE_SCREEN_SETUP", "Module & Screen Master", "/masters", "Work", "account_tree", "Configure system modules, sub-modules, and screens with Excel import", 180),

            // Delivery Group
            new ScreenDefinition("PROJECT_OVERVIEW", "Projects Overview", "/projects", "Delivery", "insights", "Overview of all active projects, health, and team members", 200),
            new ScreenDefinition("TEAM_HIERARCHY", "Project Teams & Hierarchy", "/hierarchy", "Delivery", "account_tree", "Project Manager, Team Leader, and Developer/Tester tree structure", 210),
            new ScreenDefinition("MY_PROJECTS", "My Projects", "/my-projects", "Delivery", "folder_open", "List of projects assigned to the logged-in user", 220),

            // Administration Group
            new ScreenDefinition("REGISTERED_EMPLOYEES", "Employee Directory", "/people/accounts", "Administration", "badge", "User directory, role assignment, and account provisioning", 240),
            new ScreenDefinition("DYNAMIC_MASTERS", "Dynamic Master Hub", "/dynamic-masters", "Administration", "dynamic_form", "Catalog hub for all user-defined dynamic master screens", 244),
            new ScreenDefinition("DYNAMIC_FORM_BUILDER", "Dynamic Form Builder", "/dynamic-masters/builder", "Administration", "tune", "Visual builder for creating and configuring dynamic master screens and fields", 246),
            new ScreenDefinition("MODULE_SCREEN_MASTER", "Module & Screen Master", "/dynamic-masters/view/MODULE_SCREEN_MASTER", "Administration", "account_tree", "Dynamic Master for managing application modules, submodules, screens, and routes", 249),
            new ScreenDefinition("ORGANIZATION_MASTER", "Organization Master", "/dynamic-masters/view/ORGANIZATION_MASTER", "Administration", "corporate_fare", "Enterprise organization master for managing client corporations, subsidiaries, and branches", 251),
            new ScreenDefinition("ROLE_ACCESS_CONFIG", "Role Permissions (RBAC)", "/role-access", "Administration", "admin_panel_settings", "Centralized configuration screen for role-based screen access and permissions", 250),
            new ScreenDefinition("AUDIT_LOGS", "Audit Logs", "/audit-logs", "Administration", "manage_history", "Complete historical timeline of all transactions, activities, status updates, and deletions across the application", 255),

            // Time Group
            new ScreenDefinition("SUBMIT_TIMESHEET", "Log Time", "/timesheets/new", "Time", "edit_calendar", "Log daily work hours against assigned project tasks", 260),
            new ScreenDefinition("MY_TIMESHEETS", "My Timesheet History", "/timesheets/my", "Time", "calendar_month", "View personal timesheet history, approval statuses, and export", 270),
            new ScreenDefinition("TIMESHEET_APPROVALS", "Timesheet Approvals", "/timesheets/approvals", "Time", "approval", "Review and approve/reject timesheet submissions from team members", 280),
            new ScreenDefinition("TIMESHEET_REPORTS", "Timesheet Reports", "/timesheets", "Time", "table_view", "Detailed team timesheet reporting and CSV export", 290),

            // Account Group
            new ScreenDefinition("USER_PROFILE", "My Profile", "/profile", "Account", "manage_accounts", "Manage user account details and profile information", 300),
            new ScreenDefinition("SETTINGS", "System Settings", "/settings", "Account", "tune", "Application theme, workspace preferences, and configuration", 310)
    );

    public RolePermissionService(RolePermissionRepository repository) {
        this.repository = repository;
    }

    public List<ScreenDefinition> getAllSystemScreens() {
        return SYSTEM_SCREENS;
    }

    private void syncScreenMetadata(RolePermissionConfig config) {
        if (config == null || config.getPermissions() == null) return;
        config.setRoleName(friendlyRoleName(config.getRole()));

        // Migrate retired or legacy aliases (e.g. DELETED_TICKETS -> AUDIT_LOGS)
        for (ScreenPermissionItem item : config.getPermissions()) {
            if ("DELETED_TICKETS".equals(item.getScreenId())) {
                item.setScreenId("AUDIT_LOGS");
                item.setRoute("/audit-logs");
            }
        }

        Map<String, ScreenDefinition> defMap = SYSTEM_SCREENS.stream()
                .collect(Collectors.toMap(ScreenDefinition::getId, s -> s, (a, b) -> a));
        // Remove screens that have been retired from the system
        config.getPermissions().removeIf(item -> item.getScreenId() != null && !defMap.containsKey(item.getScreenId()));

        Set<String> existingIds = new HashSet<>();
        for (ScreenPermissionItem item : config.getPermissions()) {
            existingIds.add(item.getScreenId());
            ScreenDefinition def = defMap.get(item.getScreenId());
            if (def != null) {
                item.setScreenName(def.getName());
                item.setCategory(def.getCategory());
                item.setDescription(def.getDescription());
                item.setIcon(def.getIcon());
                item.setRoute(def.getRoute());
            }
        }

        // Auto-seed newly added system screens (e.g. AUDIT_LOGS)
        for (ScreenDefinition def : SYSTEM_SCREENS) {
            if (!existingIds.contains(def.getId())) {
                boolean allow = Roles.SUPER_ADMIN.equals(config.getRole()) || Roles.LEGACY_ADMIN.equals(config.getRole())
                        || (Roles.PROJECT_MANAGER.equals(config.getRole()) && "AUDIT_LOGS".equals(def.getId()));
                config.getPermissions().add(ScreenPermissionItem.fromDefinition(def, allow, allow, allow, allow));
            }
        }

        // Auto-migrate TEAM_LEAD if it is in the legacy placeholder state (<= 2 allowed screens)
        if (Roles.TEAM_LEAD.equals(config.getRole()) || Roles.LEGACY_TEAM_LEADER.equals(config.getRole())) {
            long allowedCount = config.getPermissions().stream().filter(ScreenPermissionItem::isAllowed).count();
            if (allowedCount <= 2) {
                RolePermissionConfig fresh = buildDefaultConfigForRole(Roles.TEAM_LEAD, "System");
                config.setPermissions(fresh.getPermissions());
                repository.save(config);
                log.info("Auto-migrated TEAM_LEAD permissions from legacy 2-screen state to full default screen permissions ({} screens allowed).",
                        fresh.getPermissions().stream().filter(ScreenPermissionItem::isAllowed).count());
            }
        }
    }

    public List<RolePermissionConfig> getAllConfigs() {
        // Clean up obsolete DEVELOPER_LEAD config from database if present
        try {
            repository.deleteByRole("DEVELOPER_LEAD");
        } catch (Exception ignored) {}

        // Ensure defaults are saved if database is empty
        for (String role : Roles.ASSIGNABLE) {
            if (!repository.existsByRole(role)) {
                repository.save(buildDefaultConfigForRole(role, "System"));
            }
        }
        return repository.findAll().stream()
                .filter(c -> Roles.ASSIGNABLE.contains(Roles.normalise(c.getRole())))
                .peek(this::syncScreenMetadata)
                .sorted(Comparator.comparingInt(c -> roleDisplayOrder(c.getRole())))
                .collect(Collectors.toList());
    }

    public RolePermissionConfig getConfigForRole(String rawRole) {
        String role = Roles.normalise(rawRole);
        RolePermissionConfig config = repository.findByRole(role)
                .orElseGet(() -> {
                    RolePermissionConfig fresh = buildDefaultConfigForRole(role, "System");
                    return repository.save(fresh);
                });
        syncScreenMetadata(config);
        return config;
    }

    public RolePermissionConfig saveConfigForRole(String rawRole, List<ScreenPermissionItem> items, String updatedBy) {
        String role = Roles.normalise(rawRole);
        RolePermissionConfig config = repository.findByRole(role)
                .orElseGet(() -> new RolePermissionConfig(role, friendlyRoleName(role), new ArrayList<>(), updatedBy));

        config.setRoleName(friendlyRoleName(role));
        config.setPermissions(items != null ? items : new ArrayList<>());
        config.setUpdatedAt(Instant.now());
        config.setUpdatedBy(updatedBy != null ? updatedBy : "Admin");

        RolePermissionConfig saved = repository.save(config);
        log.info("Saved dynamic screen access configuration for role {} with {} screen permissions by {}",
                role, saved.getPermissions().size(), updatedBy);
        return saved;
    }

    public RolePermissionConfig resetRoleToDefault(String rawRole, String updatedBy) {
        String role = Roles.normalise(rawRole);
        RolePermissionConfig defaultConfig = buildDefaultConfigForRole(role, updatedBy);
        RolePermissionConfig saved = repository.save(defaultConfig);
        log.info("Reset screen access configuration for role {} to system defaults by {}", role, updatedBy);
        return saved;
    }

    public Map<String, Boolean> getAccessibleRoutesForRole(String rawRole) {
        RolePermissionConfig config = getConfigForRole(rawRole);
        Map<String, Boolean> result = new HashMap<>();
        for (ScreenPermissionItem item : config.getPermissions()) {
            if (item.getRoute() != null && !item.getRoute().isBlank()) {
                // If any screen pointing to this route is allowed, allow the route
                boolean current = result.getOrDefault(item.getRoute(), false);
                result.put(item.getRoute(), current || item.isAllowed());
            }
        }
        return result;
    }

    public boolean isRouteAccessible(String rawRole, String route) {
        if (route == null || route.isBlank()) {
            return true;
        }
        String cleanRoute = route.split("[?#]")[0].trim();
        Map<String, Boolean> accessible = getAccessibleRoutesForRole(rawRole);

        // Direct match
        if (accessible.containsKey(cleanRoute)) {
            return Boolean.TRUE.equals(accessible.get(cleanRoute));
        }

        // Prefix match for subpaths (e.g. /tasks/123 -> /tasks)
        for (Map.Entry<String, Boolean> entry : accessible.entrySet()) {
            if (cleanRoute.startsWith(entry.getKey() + "/")) {
                return entry.getValue();
            }
        }

        // Defaults to allowed if route not recognized in catalogue
        return true;
    }

    public boolean hasPermission(String rawRole, String screenId, String action) {
        String role = Roles.normalise(rawRole);
        // Super Admin always retains access to the role access config screen itself to prevent lockouts
        if ("ROLE_ACCESS_CONFIG".equalsIgnoreCase(screenId) && (Roles.isSuperAdmin(role) || Roles.LEGACY_ADMIN.equals(role))) {
            return true;
        }
        RolePermissionConfig config = getConfigForRole(role);
        for (ScreenPermissionItem item : config.getPermissions()) {
            if (item.getScreenId() != null && item.getScreenId().equalsIgnoreCase(screenId)) {
                if (!item.isAllowed()) {
                    return false;
                }
                if (action == null || action.isBlank()) {
                    return true;
                }
                switch (action.toLowerCase(Locale.ROOT)) {
                    case "view":
                        return item.isCanView();
                    case "add":
                    case "create":
                    case "edit":
                    case "update":
                        return item.isCanEdit();
                    case "delete":
                        return item.isCanDelete();
                    case "export":
                        return item.isCanExport();
                    default:
                        return false;
                }
            }
        }
        return true;
    }

    /**
     * Constructs baseline recommended permissions for any given role.
     */
    public RolePermissionConfig buildDefaultConfigForRole(String role, String updatedBy) {
        String normRole = Roles.normalise(role);
        String roleName = friendlyRoleName(normRole);

        Set<String> allowedIds;
        boolean defaultCanEdit = false;
        boolean defaultCanDelete = false;
        boolean defaultCanExport = false;

        switch (normRole) {
            case Roles.SUPER_ADMIN:
            case Roles.LEGACY_ADMIN:
                // Super Admin has all screens and full permissions
                allowedIds = SYSTEM_SCREENS.stream().map(ScreenDefinition::getId).collect(Collectors.toSet());
                defaultCanEdit = true;
                defaultCanDelete = true;
                defaultCanExport = true;
                break;

            case Roles.PROJECT_MANAGER:
                allowedIds = Set.of(
                        "DASHBOARD", "PROJECT_OVERVIEW", "TEAM_HIERARCHY", "MY_PROJECTS",
                        "SUBMIT_TIMESHEET", "MY_TIMESHEETS", "TIMESHEET_APPROVALS", "TIMESHEET_REPORTS",
                        "AUDIT_LOGS", "USER_PROFILE", "SETTINGS"
                );
                defaultCanEdit = true;
                defaultCanDelete = false;
                defaultCanExport = true;
                break;

            case Roles.TEAM_LEAD:
                allowedIds = Set.of(
                        "DEVELOPER_BOARD", "TESTER_BOARD", "DEV_TEAM_ASSIGNMENT", "TESTING_REVIEW",
                        "DEV_COMPLETED_TICKETS", "ON_HOLD_TICKETS", "TESTED_COMPLETED_REVIEW", "MY_TICKETS",
                        "TICKET_BOARD", "ALL_TICKETS", "PROJECT_OVERVIEW", "TEAM_HIERARCHY", "MY_PROJECTS",
                        "SUBMIT_TIMESHEET", "MY_TIMESHEETS", "TIMESHEET_APPROVALS", "TIMESHEET_REPORTS",
                        "USER_PROFILE", "SETTINGS"
                );
                defaultCanEdit = true;
                defaultCanDelete = false;
                defaultCanExport = true;
                break;

            case Roles.DEVELOPER_LEAD:
                allowedIds = Set.of(
                        "DEVELOPER_BOARD", "DEV_TEAM_ASSIGNMENT", "DEV_COMPLETED_TICKETS", "ON_HOLD_TICKETS",
                        "TESTED_COMPLETED_REVIEW", "MY_TICKETS", "TICKET_BOARD",
                        "TEAM_HIERARCHY", "MY_PROJECTS", "SUBMIT_TIMESHEET", "MY_TIMESHEETS", "TIMESHEET_APPROVALS",
                        "TIMESHEET_REPORTS", "USER_PROFILE", "SETTINGS"
                );
                defaultCanEdit = true;
                defaultCanDelete = false;
                defaultCanExport = true;
                break;

            case Roles.EMPLOYEE: // Developer
                allowedIds = Set.of(
                        "DEVELOPER_BOARD", "MY_TICKETS", "MY_COMPLETED_TICKETS_DEV", "ON_HOLD_TICKETS",
                        "TICKET_BOARD", "MY_PROJECTS", "SUBMIT_TIMESHEET", "MY_TIMESHEETS",
                        "USER_PROFILE", "SETTINGS"
                );
                defaultCanEdit = true;
                defaultCanDelete = false;
                defaultCanExport = false;
                break;

            case Roles.TESTER_LEAD:
                allowedIds = Set.of(
                        "TESTER_BOARD", "TESTING_LEAD_DASHBOARD", "RAISE_TICKET", "MY_SUBMISSIONS",
                        "TESTING_REVIEW", "TESTED_COMPLETED_REVIEW", "MY_TICKETS", "MY_COMPLETED_TICKETS_QA",
                        "TICKET_BOARD", "TEAM_HIERARCHY", "MY_PROJECTS", "SUBMIT_TIMESHEET", "MY_TIMESHEETS",
                        "TIMESHEET_APPROVALS", "TIMESHEET_REPORTS", "USER_PROFILE", "SETTINGS"
                );
                defaultCanEdit = true;
                defaultCanDelete = false;
                defaultCanExport = true;
                break;

            case Roles.TESTER:
                allowedIds = Set.of(
                        "TESTER_BOARD", "RAISE_TICKET", "MY_SUBMISSIONS", "MY_TICKETS", "MY_COMPLETED_TICKETS_QA",
                        "TICKET_BOARD", "MY_PROJECTS", "SUBMIT_TIMESHEET", "MY_TIMESHEETS",
                        "USER_PROFILE", "SETTINGS"
                );
                defaultCanEdit = true;
                defaultCanDelete = false;
                defaultCanExport = false;
                break;

            default:
                allowedIds = Set.of("USER_PROFILE", "SETTINGS");
                break;
        }

        List<ScreenPermissionItem> items = new ArrayList<>();
        for (ScreenDefinition screen : SYSTEM_SCREENS) {
            boolean allowed = allowedIds.contains(screen.getId());
            boolean canEdit = allowed && (defaultCanEdit || isRoleAdmin(normRole));
            boolean canDelete = allowed && isRoleAdmin(normRole);
            boolean canExport = allowed && (defaultCanExport || isRoleAdmin(normRole));

            items.add(new ScreenPermissionItem(
                    screen.getId(),
                    screen.getName(),
                    screen.getRoute(),
                    screen.getCategory(),
                    screen.getIcon(),
                    screen.getDescription(),
                    allowed,
                    allowed,
                    canEdit,
                    canDelete,
                    canExport
            ));
        }

        return new RolePermissionConfig(normRole, roleName, items, updatedBy);
    }

    private boolean isRoleAdmin(String role) {
        return Roles.isSuperAdmin(role) || Roles.LEGACY_ADMIN.equals(role);
    }

    public static String friendlyRoleName(String role) {
        if (role == null) return "Unknown";
        switch (role.toUpperCase(Locale.ROOT)) {
            case Roles.SUPER_ADMIN:
            case Roles.LEGACY_ADMIN:
                return "Super Admin";
            case Roles.PROJECT_MANAGER:
                return "Project Manager";
            case Roles.TEAM_LEAD:
            case Roles.LEGACY_TEAM_LEADER:
                return "Team Leader";
            case Roles.DEVELOPER_LEAD:
                return "Development Team Lead";
            case Roles.EMPLOYEE:
                return "Software Developer";
            case Roles.TESTER_LEAD:
                return "QA Team Lead";
            case Roles.TESTER:
                return "QA Engineer";
            default:
                return role;
        }
    }

    private static int roleDisplayOrder(String role) {
        if (role == null) return 99;
        switch (role.toUpperCase(Locale.ROOT)) {
            case Roles.SUPER_ADMIN:
            case Roles.LEGACY_ADMIN:
                return 1;
            case Roles.PROJECT_MANAGER:
                return 2;
            case Roles.TEAM_LEAD:
            case Roles.LEGACY_TEAM_LEADER:
                return 3;
            case Roles.DEVELOPER_LEAD:
                return 4;
            case Roles.EMPLOYEE:
                return 5;
            case Roles.TESTER_LEAD:
                return 6;
            case Roles.TESTER:
                return 7;
            default:
                return 99;
        }
    }
}
