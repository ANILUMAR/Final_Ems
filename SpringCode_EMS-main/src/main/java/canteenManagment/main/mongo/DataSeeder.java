package canteenManagment.main.mongo;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import canteenManagment.main.UserEntity.AssignTask;
import canteenManagment.main.UserEntity.MasterAssignmentTbl;
import canteenManagment.main.UserEntity.MasterProjectTbl;
import canteenManagment.main.UserEntity.Project;
import canteenManagment.main.UserEntity.Task;
import canteenManagment.main.UserEntity.TimesheetEntry;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.UserEntity.WorkStatus;
import canteenManagment.main.master.MasterDataService;
import canteenManagment.main.master.MasterEntry;
import canteenManagment.main.master.MasterEntryRepository;
import canteenManagment.main.security.PasswordCipher;
import canteenManagment.main.security.Roles;
import canteenManagment.main.userReposerity.MasterAssignmentRepository;
import canteenManagment.main.userReposerity.MasterProjectRepository;
import canteenManagment.main.userReposerity.ProjectRepository;
import canteenManagment.main.userReposerity.TaskRepository;
import canteenManagment.main.userReposerity.TimesheetRepository;
import canteenManagment.main.userReposerity.UserRepository;
import canteenManagment.main.userReposerity.assignTaskRepository;
import canteenManagment.main.userReposerity.AssignBugRepository;
import canteenManagment.main.userReposerity.StatusChangeRepository;
import canteenManagment.main.userReposerity.DeletedTaskRepository;

/**
 * Loads the demo workspace on first start: the three role logins plus enough
 * projects, tasks and timesheets for the admin, developer and tester boards to
 * show different data. It is a no-op once the {@code user} collection has rows
 * and can be switched off with {@code ems.seed.enabled=false}.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    /** id, email, name, role, password - the demo accounts this seeder writes. */
    private static final Object[][] DEMO_USERS = {
            {1L, "admin@ems.com", "Admin", "SUPER_ADMIN", "Admin@123"},
            {2L, "developer@ems.com", "Raju", "EMPLOYEE", "Developer@123"},
            {3L, "tester@ems.com", "Priya", "TESTER", "Tester@1234"},
            {4L, "arun@ems.com", "Arun", Roles.TEAM_LEAD, "Employee@123"},
            {5L, "divya@ems.com", "Divya", "TESTER_LEAD", "Employee@123"},
            {6L, "karthik@ems.com", "Karthik", "EMPLOYEE", "Employee@123"},
            {7L, "meena@ems.com", "Meena", "EMPLOYEE", "Employee@123"},
            {8L, "vikram@ems.com", "Vikram", "EMPLOYEE", "Employee@123"},
            {9L, "lead@ems.com", "Suresh", "TEAM_LEAD", "Employee@123"},
    };

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final MasterProjectRepository masterProjectRepository;
    private final MasterAssignmentRepository masterAssignmentRepository;
    private final TaskRepository taskRepository;
    private final TimesheetRepository timesheetRepository;
    private final assignTaskRepository assignTaskRepository;
    private final AssignBugRepository assignBugRepository;
    private final StatusChangeRepository statusChangeRepository;
    private final DeletedTaskRepository deletedTaskRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordCipher passwordCipher;
    private final MasterEntryRepository masterEntryRepository;
    private final MasterDataService masterDataService;

    @Value("${ems.seed.enabled:true}")
    private boolean enabled;

    @Value("${ems.reset.work.data:false}")
    private boolean resetWorkData;

    public DataSeeder(UserRepository userRepository,
                      ProjectRepository projectRepository,
                      MasterProjectRepository masterProjectRepository,
                      MasterAssignmentRepository masterAssignmentRepository,
                      TaskRepository taskRepository,
                      TimesheetRepository timesheetRepository,
                      assignTaskRepository assignTaskRepository,
                      AssignBugRepository assignBugRepository,
                      StatusChangeRepository statusChangeRepository,
                      DeletedTaskRepository deletedTaskRepository,
                      PasswordEncoder passwordEncoder,
                      PasswordCipher passwordCipher,
                      MasterEntryRepository masterEntryRepository,
                      MasterDataService masterDataService) {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.masterProjectRepository = masterProjectRepository;
        this.masterAssignmentRepository = masterAssignmentRepository;
        this.taskRepository = taskRepository;
        this.timesheetRepository = timesheetRepository;
        this.assignTaskRepository = assignTaskRepository;
        this.assignBugRepository = assignBugRepository;
        this.statusChangeRepository = statusChangeRepository;
        this.deletedTaskRepository = deletedTaskRepository;
        this.passwordEncoder = passwordEncoder;
        this.passwordCipher = passwordCipher;
        this.masterEntryRepository = masterEntryRepository;
        this.masterDataService = masterDataService;
    }

    @Override
    public void run(String... args) {
        if (resetWorkData) {
            log.info("Resetting work data as requested (preserving registered employees and master/project data)...");
            assignTaskRepository.deleteAll();
            assignBugRepository.deleteAll();
            taskRepository.deleteAll();
            timesheetRepository.deleteAll();
            statusChangeRepository.deleteAll();
            deletedTaskRepository.deleteAll();
            log.info("Work data reset complete: All tasks, bugs, assignments, timesheets, and status histories deleted.");
        }

        if (!enabled) {
            log.info("Demo seeding disabled (ems.seed.enabled=false).");
            return;
        }

        // Each collection is checked on its own so a half-finished seed (for
        // example an error halfway through) is completed on the next start.
        List<String> seeded = new ArrayList<>();
        if (userRepository.count() == 0) {
            seedUsers();
            seeded.add("users");
        }
        if (projectRepository.count() == 0) {
            seedProjects();
            seeded.add("projects");
        }
        if (masterAssignmentRepository.count() == 0) {
            seedAssignmentLookups();
            seeded.add("assignment lookups");
        }
        // The module / sub module / screen lists the task pickers read.
        if (masterEntryRepository.count() == 0) {
            seedMasterData();
            seeded.add("master data");
        }
        if (taskRepository.count() == 0) {
            seedTasks();
            seeded.add("tasks");
        }
        if (timesheetRepository.count() == 0) {
            seedTimesheets();
            seeded.add("timesheets");
        }

        backfillStatuses();
        backfillPasswordReview();
        migrateLegacyAdminRole();
        migrateLegacyDeveloperLeadRole();
        migrateTaskCodes();
        seedSampleTestingEmployees();

        if (seeded.isEmpty()) {
            log.info("Mongo already holds the demo dataset - nothing seeded.");
        } else {
            log.info("Demo data created for: {}", String.join(", ", seeded));
        }
    }

    /**
     * Rows written before the lifecycle existed have no status. They are read as
     * TODO, but persisting the value keeps the counters and filters consistent.
     */
    private void backfillStatuses() {
        List<AssignTask> assignments = assignTaskRepository.findAll().stream()
                .filter(a -> a.getStatus() == null)
                .collect(Collectors.toList());
        assignments.forEach(a -> a.setStatus(WorkStatus.TODO));
        if (!assignments.isEmpty()) {
            assignTaskRepository.saveAll(assignments);
        }

        List<Task> tasks = taskRepository.findAll().stream()
                .filter(t -> t.getStatus() == null)
                .collect(Collectors.toList());
        tasks.forEach(t -> t.setStatus(WorkStatus.TODO));
        if (!tasks.isEmpty()) {
            taskRepository.saveAll(tasks);
        }

        if (!assignments.isEmpty() || !tasks.isEmpty()) {
            log.info("Backfilled work status on {} assignment(s) and {} task(s).",
                    assignments.size(), tasks.size());
        }
    }

    private void seedUsers() {
        for (Object[] row : DEMO_USERS) {
            userRepository.save(employee((Long) row[0], (String) row[1], (String) row[2],
                    (String) row[3], (String) row[4]));
        }
    }

    /**
     * Seeds sample Developers and Testers for testing and evaluation across the application.
     * Safe to run repeatedly: skips any account that already exists.
     */
    private void seedSampleTestingEmployees() {
        Object[][] sampleUsers = {
                // Project Manager (PROJECT_MANAGER)
                {"rajesh.pm@ems.com", "Rajesh Verma", Roles.PROJECT_MANAGER, "Manager@123", "9876543218", "Hyderabad"},

                // Developers (EMPLOYEE)
                {"suresh.dev@ems.com", "Suresh Kumar", Roles.EMPLOYEE, "Developer@123", "9876543210", "Bangalore"},
                {"ananya.dev@ems.com", "Ananya Sharma", Roles.EMPLOYEE, "Developer@123", "9876543211", "Hyderabad"},
                {"rahul.dev@ems.com", "Rahul Verma", Roles.EMPLOYEE, "Developer@123", "9876543212", "Pune"},
                {"sneha.dev@ems.com", "Sneha Patel", Roles.EMPLOYEE, "Developer@123", "9876543213", "Mumbai"},

                // Testers (TESTER)
                {"pooja.qa@ems.com", "Pooja Nair", Roles.TESTER, "Tester@123", "9876543214", "Chennai"},
                {"deepak.qa@ems.com", "Deepak Reddy", Roles.TESTER, "Tester@123", "9876543215", "Bangalore"},
                {"kavita.qa@ems.com", "Kavita Sen", Roles.TESTER, "Tester@123", "9876543216", "Kolkata"},
                {"manoj.qa@ems.com", "Manoj Joshi", Roles.TESTER, "Tester@123", "9876543217", "Delhi"}
        };

        long nextId = userRepository.findAll().stream()
                .mapToLong(u -> u.getId() != null ? u.getId() : 0L)
                .max()
                .orElse(0L) + 1;

        int added = 0;
        for (Object[] row : sampleUsers) {
            String email = ((String) row[0]).trim().toLowerCase(Locale.ROOT);
            String name = (String) row[1];
            String role = (String) row[2];
            String password = (String) row[3];
            String phone = (String) row[4];
            String address = (String) row[5];

            if (userRepository.findByEmailIgnoreCase(email).isEmpty()) {
                UserEntity user = new UserEntity();
                user.setId(nextId++);
                user.setEmail(email);
                user.setName(name);
                user.setLowerName(name.toLowerCase(Locale.ROOT));
                user.setPassword(passwordEncoder.encode(password));
                user.setEncryptedPassword(passwordCipher.encrypt(password));
                user.setRole(role);
                user.setRoles(Roles.FAMILY_ADMIN.equals(Roles.family(role))
                        ? UserEntity.Role.ADMIN
                        : UserEntity.Role.EMPLOYEE);
                user.setGeneratedDate(new java.util.Date());
                user.setAddress(address);
                user.setPhoneNumber(phone);
                user.setActive(true);
                user.setTaskManager(Roles.TESTER.equals(role) && "pooja.qa@ems.com".equalsIgnoreCase(email));
                userRepository.save(user);
                added++;
            }
        }
        if (added > 0) {
            log.info("Seeded {} sample test employee(s) (Developers and Testers).", added);
        }
    }

    /**
     * The demo accounts were written before the readable password copy existed,
     * so the Edit employee dialog would open empty for all of them. The original
     * password cannot be recovered from the hash, so this only fills a row when
     * the stored hash still verifies against the documented seed password - a
     * password an administrator has changed is left untouched and keeps showing
     * "no readable copy".
     */
    private void backfillPasswordReview() {
        int filled = 0;
        for (Object[] row : DEMO_USERS) {
            String email = (String) row[1];
            String rawPassword = (String) row[4];

            Optional<UserEntity> found = userRepository.findByEmailIgnoreCase(email);
            if (found.isEmpty()) {
                continue;
            }
            UserEntity user = found.get();
            if (user.getEncryptedPassword() != null && !user.getEncryptedPassword().isEmpty()) {
                continue;
            }
            if (user.getPassword() == null || !passwordEncoder.matches(rawPassword, user.getPassword())) {
                continue;
            }

            user.setEncryptedPassword(passwordCipher.encrypt(rawPassword));
            userRepository.save(user);
            filled++;
        }
        if (filled > 0) {
            log.info("Stored a readable password copy for {} demo account(s).", filled);
        }
    }

    /**
     * The CEO login used to be stored as ADMIN; the split into SUPER_ADMIN and
     * the two team leaders renamed it. Rewriting the value keeps one word per
     * identity on screen, while sign-in itself already understands both.
     */
    private void migrateLegacyAdminRole() {
        List<UserEntity> legacy = userRepository.findAll().stream()
                .filter(user -> Roles.LEGACY_ADMIN.equals(Roles.raw(user.getRole())))
                .collect(Collectors.toList());
        legacy.forEach(user -> user.setRole(Roles.SUPER_ADMIN));
        if (!legacy.isEmpty()) {
            userRepository.saveAll(legacy);
            log.info("Renamed {} legacy ADMIN account(s) to SUPER_ADMIN.", legacy.size());
        }
    }

    /**
     * Converts DEVELOPER_LEAD and TEAM_LEADER accounts to TEAM_LEAD ("Team Leader")
     * as requested for the frontend development team lead.
     */
    private void migrateLegacyDeveloperLeadRole() {
        List<UserEntity> devLeads = userRepository.findAll().stream()
                .filter(user -> "DEVELOPER_LEAD".equalsIgnoreCase(Roles.raw(user.getRole()))
                        || Roles.LEGACY_TEAM_LEADER.equalsIgnoreCase(Roles.raw(user.getRole())))
                .collect(Collectors.toList());
        devLeads.forEach(user -> user.setRole(Roles.TEAM_LEAD));
        if (!devLeads.isEmpty()) {
            userRepository.saveAll(devLeads);
            log.info("Converted {} legacy DEVELOPER_LEAD account(s) to TEAM_LEAD (Team Leader).", devLeads.size());
        }
    }

    /**
     * Tasks and bugs used to share one prefix ("EMS-00042"), which said nothing
     * about what the item was. They now carry their own ("TASK-00042",
     * "BUG-00007"); restamping the shared-prefix rows - and the ones that were
     * never stamped at all - puts every item on one scheme without changing the
     * number, which is the part people quote. Codes already in the kind-based
     * format are left exactly as they are.
     */
    private void migrateTaskCodes() {
        List<AssignTask> restamped = assignTaskRepository.findAll().stream()
                .filter(item -> item.getTaskCode() == null || item.getTaskCode().trim().isEmpty()
                        || AssignTask.isLegacyCode(item.getTaskCode()))
                .collect(Collectors.toList());
        restamped.forEach(item -> item.setTaskCode(AssignTask.codeFor(item.getKind(), item.getId())));
        if (!restamped.isEmpty()) {
            assignTaskRepository.saveAll(restamped);
            log.info("Restamped {} task/bug code(s) into the task-and-bug format.", restamped.size());
        }
    }

    private UserEntity employee(Long id, String email, String name, String role, String rawPassword) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setEmail(email);
        user.setName(name);
        user.setLowerName(name.toLowerCase());
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setEncryptedPassword(passwordCipher.encrypt(rawPassword));
        user.setRole(role);
        user.setRoles(Roles.FAMILY_ADMIN.equals(Roles.family(role))
                ? UserEntity.Role.ADMIN
                : UserEntity.Role.EMPLOYEE);
        user.setGeneratedDate(new java.util.Date());
        user.setAddress("Chennai");
        user.setPhoneNumber("90000000" + id);
        return user;
    }

    private void seedProjects() {
        String[] names = {"Employee Management System", "Payroll Portal", "Mobile Timesheet"};
        String[] descriptions = {
                "Core HR workspace: employees, roles, tasks and timesheets.",
                "Salary runs, payslips and reimbursement approvals.",
                "Android/iOS client for logging hours on the go."
        };

        for (int i = 0; i < names.length; i++) {
            MasterProjectTbl master = new MasterProjectTbl();
            master.setId(i + 1);
            master.setProjectName(names[i]);
            master.setIsActive(true);
            masterProjectRepository.save(master);

            Project project = new Project();
            project.setId((long) (i + 1));
            project.setName(names[i]);
            project.setDescription(descriptions[i]);
            projectRepository.save(project);
        }
    }

    /** Dropdown values used by the "assign task" screen. */
    private void seedAssignmentLookups() {
        masterAssignmentRepository.save(assignment(1, "Authentication", "Login", "Implement login"));
        masterAssignmentRepository.save(assignment(2, "Timesheet", "Submit hours", "Add timesheet form"));
        masterAssignmentRepository.save(assignment(3, "Reporting", "Export report", "Add CSV export"));
    }

    /**
     * A starter tree for the Master data screen: five modules, the sub module
     * each one is worked through, and one or two screens below that. It is only
     * written when the collection is empty, so an admin's own edits survive.
     */
    private void seedMasterData() {
        Long authentication = module("Authentication");
        subModule(authentication, "Login", "Login form", "Forgot password");
        subModule(authentication, "Access", "Sidebar", "Role guard");

        Long timesheet = module("Timesheet");
        subModule(timesheet, "Submit hours", "Submit timesheet", "Quick fill");

        Long reporting = module("Reporting");
        subModule(reporting, "Export report", "Audit report");

        Long employee = module("Employee");
        subModule(employee, "Edit profile", "Update profile", "Profile photo");

        Long testing = module("Testing");
        subModule(testing, "Regression", "Tester board");
        subModule(testing, "Triage", "Rise bug");
    }

    private Long module(String name) {
        return masterDataService.save(MasterEntry.MODULE, name, null).getId();
    }

    private void subModule(Long moduleId, String name, String... screens) {
        Long subModuleId = masterDataService.save(MasterEntry.SUB_MODULE, name, moduleId).getId();
        for (String screen : screens) {
            masterDataService.save(MasterEntry.SCREEN, screen, subModuleId);
        }
    }

    private MasterAssignmentTbl assignment(int id, String module, String process, String create) {
        MasterAssignmentTbl row = new MasterAssignmentTbl();
        row.setId(id);
        row.setModuleDescription(module);
        row.setProcessDescription(process);
        row.setCreateDesc(create);
        return row;
    }

    private void seedTasks() {
        List<Task> tasks = new ArrayList<>();
        tasks.add(task(1, "Login screen validation", "Basic field and error state checks.", WorkStatus.DONE, 1, 2));
        tasks.add(task(2, "Role based routing", "Admin, developer and tester land on their own board.", WorkStatus.DONE, 1, 2));
        tasks.add(task(3, "Timesheet submit form", "Validate hours against the weekly budget.", WorkStatus.IN_PROGRESS, 2, 2));
        tasks.add(task(4, "Quarterly audit report", "Review access logs for the quarter.", WorkStatus.TODO, 1, 1));
        tasks.add(task(5, "Task board filters", "Filter by project, priority and module.", WorkStatus.TODO, 1, 2));
        tasks.add(task(6, "Profile photo upload", "Crop and store the avatar per employee.", WorkStatus.IN_PROGRESS, 2, 2));
        tasks.add(task(7, "Regression suite for roles", "Cover the three login flows end to end.", WorkStatus.DONE, 3, 3));
        tasks.add(task(8, "Bug triage dashboard", "Group open bugs by module and severity.", WorkStatus.TODO, 3, 3));
        taskRepository.saveAll(tasks);

        // The assign-task board is a separate collection with the richer
        // priority/module/screen metadata used by the review screens.
        String[][] meta = {
                {"1", "Login screen validation", "High", "Authentication", "Login", "LoginForm", "2"},
                {"1", "Role based routing", "High", "Authentication", "Access", "Sidebar", "2"},
                {"2", "Timesheet submit form", "Medium", "Timesheet", "Submit hours", "SubmitTimesheet", "2"},
                {"1", "Quarterly audit report", "Low", "Reporting", "Export report", "AuditReport", "1"},
                {"1", "Task board filters", "Medium", "Task", "Filter board", "AllTasks", "2"},
                {"2", "Profile photo upload", "Low", "Employee", "Edit profile", "UpdateProfile", "2"},
                {"3", "Regression suite for roles", "High", "Testing", "Regression", "TesterBoard", "3"},
                {"3", "Bug triage dashboard", "Medium", "Testing", "Triage", "RiseBug", "3"}
        };

        List<AssignTask> assignments = new ArrayList<>();
        WorkStatus[] boardStates = {
                WorkStatus.DONE, WorkStatus.DONE, WorkStatus.IN_PROGRESS, WorkStatus.TODO,
                WorkStatus.TODO, WorkStatus.IN_PROGRESS, WorkStatus.DONE, WorkStatus.TODO
        };
        for (int i = 0; i < meta.length; i++) {
            AssignTask a = new AssignTask();
            a.setId((long) (i + 1));
            a.setStatus(boardStates[i]);
            a.setProject(projectName(Integer.parseInt(meta[i][0])));
            a.setTaskTitle(meta[i][1]);
            a.setPriority(meta[i][2]);
            a.setModule(meta[i][3]);
            a.setSubModule(meta[i][4]);
            a.setScreen(meta[i][5]);
            a.setDescription(meta[i][1]);
            a.setStartDate(daysFromToday(-14 + i));
            a.setEndDate(daysFromToday(7 + i));
            a.setAssignedBy("admin@ems.com");
            UserEntity owner = userRepository.findById(Long.parseLong(meta[i][6])).orElse(null);
            a.setAssignedTo(owner);
            a.setAssignedToName(owner != null ? owner.getName() : null);
            assignments.add(a);
        }
        assignTaskRepository.saveAll(assignments);
    }

    private Task task(long id, String title, String description, WorkStatus status, int projectId, long ownerId) {
        Task task = new Task();
        task.setId(id);
        task.setTitle(title);
        task.setDescription(description);
        task.setStatus(status);

        Project project = projectRepository.findById((long) projectId).orElse(null);
        task.setProject(project);

        UserEntity owner = userRepository.findById(ownerId).orElse(null);
        task.setUser(owner);
        return task;
    }

    private String projectName(int projectId) {
        return masterProjectRepository.findById(projectId)
                .map(MasterProjectTbl::getProjectName)
                .orElse("Employee Management System");
    }

    private void seedTimesheets() {
        // employeeName is the login email: the API scopes every non-admin to it.
        List<TimesheetEntry> entries = Arrays.asList(
                timesheet(1, "developer@ems.com", -6, 8, "Employee Management System", "APPROVED"),
                timesheet(2, "developer@ems.com", -5, 7, "Payroll Portal", "APPROVED"),
                timesheet(3, "developer@ems.com", -4, 6, "Mobile Timesheet", "PENDING"),
                timesheet(4, "tester@ems.com", -6, 7, "Employee Management System", "APPROVED"),
                timesheet(5, "tester@ems.com", -3, 6, "Mobile Timesheet", "PENDING")
        );
        timesheetRepository.saveAll(entries);
    }

    private TimesheetEntry timesheet(long id, String email, int dayOffset, int hours, String project, String status) {
        TimesheetEntry entry = new TimesheetEntry();
        entry.setId(id);
        entry.setEmployeeName(email);
        entry.setDate(LocalDate.now().plusDays(dayOffset));
        entry.setHours(hours);
        entry.setProject(project);
        entry.setStatus(status);
        return entry;
    }

    private Date daysFromToday(int offset) {
        return Date.from(LocalDate.now().plusDays(offset).atStartOfDay(ZoneId.systemDefault()).toInstant());
    }
}
