package canteenManagment.main.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import canteenManagment.main.UserEntity.AssignBug;
import canteenManagment.main.UserEntity.AssignTask;
import canteenManagment.main.UserEntity.DailyTimesheet;
import canteenManagment.main.UserEntity.DailyTimesheetItem;
import canteenManagment.main.UserEntity.TimesheetAudit;
import canteenManagment.main.UserEntity.TimesheetEntry;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.security.AuthContext;
import canteenManagment.main.security.Roles;
import canteenManagment.main.userReposerity.AssignBugRepository;
import canteenManagment.main.userReposerity.DailyTimesheetRepository;
import canteenManagment.main.userReposerity.TimesheetRepository;
import canteenManagment.main.userReposerity.UserRepository;
import canteenManagment.main.userReposerity.assignTaskRepository;

@Service
public class TimesheetService {

    @Autowired
    private TimesheetRepository legacyRepository;

    @Autowired
    private DailyTimesheetRepository dailyRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private assignTaskRepository taskRepository;

    @Autowired
    private AssignBugRepository bugRepository;

    @Autowired
    private TaskMailService mailService;

    @Autowired
    private canteenManagment.main.hierarchy.TeamHierarchyService hierarchyService;

    /* =========================================================================
     * LEGACY BACKWARD COMPATIBILITY
     * ========================================================================= */

    public List<TimesheetEntry> getAll() {
        return legacyRepository.findAll();
    }

    public TimesheetEntry save(TimesheetEntry entry) {
        return legacyRepository.save(entry);
    }

    /* =========================================================================
     * DAILY TIMESHEET WORKFLOW
     * ========================================================================= */

    /**
     * Saves or submits a daily timesheet.
     * Automatically calculates total hours, validates entries, resolves reporting person,
     * prevents modification of approved sheets, logs audit trail, and dispatches notifications.
     */
    public DailyTimesheet saveDailyTimesheet(DailyTimesheet incoming, Authentication authentication, boolean submit) {
        if (incoming == null) {
            throw new IllegalArgumentException("Timesheet data is required.");
        }
        if (incoming.getWorkDate() == null) {
            throw new IllegalArgumentException("Work date is mandatory.");
        }
        if (incoming.getEntries() == null || incoming.getEntries().isEmpty()) {
            throw new IllegalArgumentException("At least one task entry is required.");
        }

        String callerEmail = AuthContext.email(authentication);
        UserEntity caller = userRepository.findByEmailIgnoreCase(callerEmail)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + callerEmail));

        // Security check: non-admin can only book hours for their own account
        String employeeEmail = AuthContext.isAdmin(authentication) && incoming.getEmployeeEmail() != null && !incoming.getEmployeeEmail().trim().isEmpty()
                ? incoming.getEmployeeEmail().trim().toLowerCase(Locale.ROOT)
                : caller.getEmail().toLowerCase(Locale.ROOT);

        UserEntity employee = userRepository.findByEmailIgnoreCase(employeeEmail).orElse(caller);

        // Check if an existing daily timesheet exists for this date and employee
        Optional<DailyTimesheet> existingOpt = dailyRepository.findByWorkDateAndEmployeeEmailIgnoreCase(incoming.getWorkDate(), employeeEmail);

        DailyTimesheet sheet;
        boolean isResubmit = false;

        if (existingOpt.isPresent()) {
            sheet = existingOpt.get();
            if ("APPROVED".equalsIgnoreCase(sheet.getStatus())) {
                throw new IllegalStateException("The timesheet for " + incoming.getWorkDate() + " has already been approved and is read-only.");
            }
            if ("REJECTED".equalsIgnoreCase(sheet.getStatus()) && submit) {
                isResubmit = true;
            }
        } else {
            sheet = new DailyTimesheet();
            sheet.setId(UUID.randomUUID().toString());
            sheet.setCreatedAt(new Date());
            sheet.setHistory(new ArrayList<>());
        }

        sheet.setEmployeeId(employee.getId());
        sheet.setEmployeeEmail(employee.getEmail());
        sheet.setEmployeeName(employee.getName() != null ? employee.getName() : employee.getEmail());
        sheet.setEmployeeRole(employee.getRole());
        sheet.setWorkDate(incoming.getWorkDate());

        // Validate and sanitize each entry
        List<DailyTimesheetItem> validatedEntries = new ArrayList<>();
        double sumHours = 0.0;

        for (DailyTimesheetItem item : incoming.getEntries()) {
            if (item == null) continue;
            if (item.getProject() == null || item.getProject().trim().isEmpty()) {
                throw new IllegalArgumentException("Project is mandatory for each task entry.");
            }
            if (item.getWorkDescription() == null || item.getWorkDescription().trim().isEmpty()) {
                throw new IllegalArgumentException("Work description is mandatory for each task entry.");
            }
            if (item.getHours() == null || item.getHours() <= 0) {
                throw new IllegalArgumentException("Hours worked must be greater than zero.");
            }

            DailyTimesheetItem cleanItem = new DailyTimesheetItem();
            cleanItem.setId(item.getId() != null && !item.getId().trim().isEmpty() ? item.getId() : UUID.randomUUID().toString());
            cleanItem.setProject(item.getProject().trim());
            cleanItem.setTaskId(item.getTaskId());
            cleanItem.setTaskCode(item.getTaskCode() != null && !item.getTaskCode().trim().isEmpty() ? item.getTaskCode().trim().toUpperCase(Locale.ROOT) : "OTHER");
            cleanItem.setTaskTitle(item.getTaskTitle() != null ? item.getTaskTitle().trim() : "Other Work");
            cleanItem.setKind(item.getKind() != null ? item.getKind().trim().toUpperCase(Locale.ROOT) : "TASK");
            cleanItem.setWorkDescription(item.getWorkDescription().trim());
            cleanItem.setHours(Math.round(item.getHours() * 10.0) / 10.0);
            cleanItem.setRemarks(item.getRemarks() != null ? item.getRemarks().trim() : "");

            validatedEntries.add(cleanItem);
            sumHours += cleanItem.getHours();
        }

        if (validatedEntries.isEmpty()) {
            throw new IllegalArgumentException("At least one valid task entry is required.");
        }

        sumHours = Math.round(sumHours * 10.0) / 10.0;
        sheet.setEntries(validatedEntries);
        sheet.setTotalHours(sumHours);

        // Overtime check (standard 8h)
        if (incoming.getOvertimeRemarks() != null && !incoming.getOvertimeRemarks().trim().isEmpty()) {
            sheet.setOvertimeRemarks(incoming.getOvertimeRemarks().trim());
        }

        if (sumHours > 8.0 && submit) {
            if (sheet.getOvertimeRemarks() == null || sheet.getOvertimeRemarks().trim().isEmpty()) {
                // If overtime note is missing, check if any entry has a remark, otherwise require remarks
                boolean hasEntryRemarks = validatedEntries.stream().anyMatch(e -> e.getRemarks() != null && !e.getRemarks().trim().isEmpty());
                if (!hasEntryRemarks) {
                    throw new IllegalArgumentException("Total daily hours exceed standard 8 hours. Overtime remarks are required.");
                }
            }
        }

        // Dynamically resolve reporting person for this employee
        resolveReportingPerson(sheet, employee);

        if (sheet.getHistory() == null) {
            sheet.setHistory(new ArrayList<>());
        }

        String callerName = caller.getName() != null ? caller.getName() : caller.getEmail();

        if (submit) {
            sheet.setStatus("SUBMITTED");
            sheet.setSubmittedAt(new Date());
            sheet.setRejectionReason(null); // Clear previous rejection note on resubmit

            String action = isResubmit ? "RESUBMITTED" : "SUBMITTED";
            sheet.getHistory().add(new TimesheetAudit(
                    action,
                    caller.getEmail(),
                    callerName,
                    new Date(),
                    isResubmit ? "Timesheet revised and resubmitted for approval" : "Timesheet submitted for approval"
            ));

            DailyTimesheet saved = dailyRepository.save(sheet);
            // Notify reporting person asynchronously
            mailService.timesheetSubmitted(saved, saved.getReportingPersonEmail(), isResubmit);
            return saved;
        } else {
            sheet.setStatus("DRAFT");
            sheet.getHistory().add(new TimesheetAudit(
                    "DRAFT_SAVED",
                    caller.getEmail(),
                    callerName,
                    new Date(),
                    "Saved as draft"
            ));
            return dailyRepository.save(sheet);
        }
    }

    /** Resolves the reporting person based on company reporting structure and roles. */
    private void resolveReportingPerson(DailyTimesheet sheet, UserEntity employee) {
        String role = Roles.raw(employee.getRole());
        String empEmail = employee.getEmail();

        // 1. Check if employee is mapped under a specific Team Lead in TeamHierarchy
        if (hierarchyService != null && empEmail != null) {
            var leadOpt = hierarchyService.findReportingLeadForEmployee(empEmail);
            if (leadOpt.isPresent()) {
                var lead = leadOpt.get();
                sheet.setReportingPersonEmail(lead.getLeadEmail());
                sheet.setReportingPersonName(lead.getLeadName() != null ? lead.getLeadName() : lead.getLeadEmail());
                return;
            }

            // 2. If caller is a Team Lead, check if they are mapped under a Project Manager
            if (Roles.isDeveloperLead(role) || Roles.isTesterLead(role)) {
                var pmOpt = hierarchyService.findProjectManagerForLead(empEmail);
                if (pmOpt.isPresent()) {
                    var pm = pmOpt.get();
                    sheet.setReportingPersonEmail(pm.getProjectManagerEmail());
                    sheet.setReportingPersonName(pm.getProjectManagerName() != null ? pm.getProjectManagerName() : pm.getProjectManagerEmail());
                    return;
                }
            }
        }

        // 3. Fallback to default role hierarchy
        UserEntity reportingLead = null;
        if (Roles.isLead(role) || Roles.PROJECT_MANAGER.equalsIgnoreCase(role)) {
            // Team leads and PMs report to Super Admin / CEO
            reportingLead = findActiveUserByRole(Roles.SUPER_ADMIN).orElse(null);
        } else if (Roles.FAMILY_TESTER.equals(Roles.family(role))) {
            // Testers report to Tester Lead or Team Lead
            reportingLead = findActiveUserByRole(Roles.TESTER_LEAD)
                    .or(() -> findActiveUserByRole(Roles.TEAM_LEAD))
                    .orElseGet(() -> findActiveUserByRole(Roles.SUPER_ADMIN).orElse(null));
        } else {
            // Developers (EMPLOYEE) report to Developer Lead or Team Lead
            reportingLead = findActiveUserByRole(Roles.DEVELOPER_LEAD)
                    .or(() -> findActiveUserByRole(Roles.TEAM_LEAD))
                    .orElseGet(() -> findActiveUserByRole(Roles.SUPER_ADMIN).orElse(null));
        }

        if (reportingLead != null) {
            sheet.setReportingPersonEmail(reportingLead.getEmail());
            sheet.setReportingPersonName(reportingLead.getName() != null ? reportingLead.getName() : reportingLead.getEmail());
        } else {
            sheet.setReportingPersonEmail("admin@ems.local");
            sheet.setReportingPersonName("Super Admin");
        }
    }

    private Optional<UserEntity> findActiveUserByRole(String role) {
        return userRepository.findAll().stream()
                .filter(u -> !Boolean.FALSE.equals(u.getActive()))
                .filter(u -> role.equalsIgnoreCase(Roles.raw(u.getRole())))
                .findFirst();
    }

    /** Gets timesheets of the logged-in employee with optional filters. */
    public List<DailyTimesheet> getMyTimesheets(Authentication authentication,
                                                LocalDate fromDate,
                                                LocalDate toDate,
                                                String project,
                                                String status) {
        String email = AuthContext.email(authentication);
        List<DailyTimesheet> list = dailyRepository.findByEmployeeEmailIgnoreCaseOrderByWorkDateDesc(email);

        return list.stream()
                .filter(s -> fromDate == null || !s.getWorkDate().isBefore(fromDate))
                .filter(s -> toDate == null || !s.getWorkDate().isAfter(toDate))
                .filter(s -> status == null || status.equalsIgnoreCase("ALL") || status.equalsIgnoreCase(s.getStatus()))
                .filter(s -> {
                    if (project == null || project.trim().isEmpty() || project.equalsIgnoreCase("ALL")) return true;
                    return s.getEntries().stream().anyMatch(e -> project.equalsIgnoreCase(e.getProject()));
                })
                .collect(Collectors.toList());
    }

    /** Gets single daily timesheet by ID. */
    public DailyTimesheet getById(String id, Authentication authentication) {
        DailyTimesheet sheet = dailyRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Timesheet not found: " + id));

        String callerEmail = AuthContext.email(authentication);
        boolean isAdmin = AuthContext.isAdmin(authentication);
        boolean isLead = AuthContext.isLead(authentication);
        boolean isOwner = callerEmail.equalsIgnoreCase(sheet.getEmployeeEmail());
        boolean isReportingPerson = callerEmail.equalsIgnoreCase(sheet.getReportingPersonEmail());

        if (!isAdmin && !isLead && !isOwner && !isReportingPerson) {
            throw new AccessDeniedException("You do not have permission to view this timesheet.");
        }
        return sheet;
    }

    /**
     * Approvals queue for Reporting Persons, Team Leads, and Admins.
     */
    public List<DailyTimesheet> getApprovalsQueue(Authentication authentication,
                                                  String status,
                                                  String employee,
                                                  LocalDate fromDate,
                                                  LocalDate toDate) {
        if (!AuthContext.isManager(authentication)) {
            throw new AccessDeniedException("Only team leads and administrators can access the approval dashboard.");
        }

        String callerEmail = AuthContext.email(authentication);
        boolean isAdmin = AuthContext.isAdmin(authentication);
        UserEntity caller = userRepository.findByEmailIgnoreCase(callerEmail).orElse(null);
        String callerFamily = caller != null ? Roles.family(caller.getRole()) : "";

        List<DailyTimesheet> all = dailyRepository.findAll();

        return all.stream()
                // Do not show drafts in the approval queue
                .filter(s -> !"DRAFT".equalsIgnoreCase(s.getStatus()))
                // Ownership gate:
                // Super Admin sees all. Team Lead sees their team family or where they are the assigned reporting person.
                .filter(s -> {
                    if (isAdmin) return true;
                    if (callerEmail.equalsIgnoreCase(s.getReportingPersonEmail())) return true;
                    if (caller != null && Roles.isTeamLead(caller.getRole())) return true;
                    String empFamily = Roles.family(s.getEmployeeRole());
                    return callerFamily.equals(empFamily);
                })
                .filter(s -> status == null || status.equalsIgnoreCase("ALL") || status.equalsIgnoreCase(s.getStatus()))
                .filter(s -> employee == null || employee.trim().isEmpty() || employee.equalsIgnoreCase("ALL")
                        || (s.getEmployeeEmail() != null && s.getEmployeeEmail().toLowerCase().contains(employee.toLowerCase()))
                        || (s.getEmployeeName() != null && s.getEmployeeName().toLowerCase().contains(employee.toLowerCase())))
                .filter(s -> fromDate == null || !s.getWorkDate().isBefore(fromDate))
                .filter(s -> toDate == null || !s.getWorkDate().isAfter(toDate))
                .sorted((a, b) -> b.getWorkDate().compareTo(a.getWorkDate()))
                .collect(Collectors.toList());
    }

    /** Approves a timesheet. */
    public DailyTimesheet approveTimesheet(String id, Authentication authentication) {
        if (!AuthContext.isManager(authentication)) {
            throw new AccessDeniedException("Only team leads and administrators can approve timesheets.");
        }

        DailyTimesheet sheet = dailyRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Timesheet not found: " + id));

        String callerEmail = AuthContext.email(authentication);
        if (callerEmail.equalsIgnoreCase(sheet.getEmployeeEmail()) && !AuthContext.isAdmin(authentication)) {
            throw new AccessDeniedException("You cannot approve your own timesheet.");
        }

        UserEntity caller = userRepository.findByEmailIgnoreCase(callerEmail).orElse(null);
        String callerName = caller != null && caller.getName() != null ? caller.getName() : callerEmail;

        sheet.setStatus("APPROVED");
        sheet.setReviewedAt(new Date());
        sheet.setReviewedBy(callerEmail);
        sheet.setReviewedByName(callerName);
        sheet.setRejectionReason(null);

        if (sheet.getHistory() == null) {
            sheet.setHistory(new ArrayList<>());
        }
        sheet.getHistory().add(new TimesheetAudit(
                "APPROVED",
                callerEmail,
                callerName,
                new Date(),
                "Timesheet approved"
        ));

        DailyTimesheet saved = dailyRepository.save(sheet);
        mailService.timesheetApproved(saved);
        return saved;
    }

    /** Rejects a timesheet with mandatory reason. */
    public DailyTimesheet rejectTimesheet(String id, String rejectionReason, Authentication authentication) {
        if (!AuthContext.isManager(authentication)) {
            throw new AccessDeniedException("Only team leads and administrators can reject timesheets.");
        }
        if (rejectionReason == null || rejectionReason.trim().isEmpty()) {
            throw new IllegalArgumentException("A rejection reason is mandatory.");
        }

        DailyTimesheet sheet = dailyRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Timesheet not found: " + id));

        String callerEmail = AuthContext.email(authentication);
        if (callerEmail.equalsIgnoreCase(sheet.getEmployeeEmail())) {
            throw new AccessDeniedException("You cannot reject your own timesheet.");
        }

        UserEntity caller = userRepository.findByEmailIgnoreCase(callerEmail).orElse(null);
        String callerName = caller != null && caller.getName() != null ? caller.getName() : callerEmail;

        sheet.setStatus("REJECTED");
        sheet.setReviewedAt(new Date());
        sheet.setReviewedBy(callerEmail);
        sheet.setReviewedByName(callerName);
        sheet.setRejectionReason(rejectionReason.trim());

        if (sheet.getHistory() == null) {
            sheet.setHistory(new ArrayList<>());
        }
        sheet.getHistory().add(new TimesheetAudit(
                "REJECTED",
                callerEmail,
                callerName,
                new Date(),
                "Timesheet rejected: " + rejectionReason.trim()
        ));

        DailyTimesheet saved = dailyRepository.save(sheet);
        mailService.timesheetRejected(saved, rejectionReason.trim());
        return saved;
    }

    /** Marks a timesheet as Under Review. */
    public DailyTimesheet markUnderReview(String id, Authentication authentication) {
        if (!AuthContext.isManager(authentication)) {
            throw new AccessDeniedException("Only team leads and administrators can review timesheets.");
        }
        DailyTimesheet sheet = dailyRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Timesheet not found: " + id));

        String callerEmail = AuthContext.email(authentication);
        UserEntity caller = userRepository.findByEmailIgnoreCase(callerEmail).orElse(null);
        String callerName = caller != null && caller.getName() != null ? caller.getName() : callerEmail;

        sheet.setStatus("UNDER_REVIEW");
        if (sheet.getHistory() == null) {
            sheet.setHistory(new ArrayList<>());
        }
        sheet.getHistory().add(new TimesheetAudit(
                "UNDER_REVIEW",
                callerEmail,
                callerName,
                new Date(),
                "Timesheet under review by " + callerName
        ));
        return dailyRepository.save(sheet);
    }

    /** Returns assigned tasks and bugs for the logged in user in the selected project, plus 'Other Work'. */
    public List<Map<String, Object>> getMyTasksForProject(String project, Authentication authentication) {
        String email = AuthContext.email(authentication);
        UserEntity user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (user == null || project == null || project.trim().isEmpty()) {
            return Collections.emptyList();
        }

        String targetProject = project.trim();
        Long userId = user.getId();
        List<Map<String, Object>> result = new ArrayList<>();

        // Standard "Other Work" entry
        Map<String, Object> otherWork = new LinkedHashMap<>();
        otherWork.put("taskId", null);
        otherWork.put("taskCode", "OTHER");
        otherWork.put("taskTitle", "Other Work (Meetings, Training, Admin)");
        otherWork.put("kind", "OTHER");
        otherWork.put("isOther", true);
        result.add(otherWork);

        // Assigned Tasks
        List<AssignTask> tasks = taskRepository.findByAssignedTo_Id(userId);
        for (AssignTask t : tasks) {
            if (targetProject.equalsIgnoreCase(t.getProject())) {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("taskId", t.getId());
                map.put("taskCode", t.codeOrGenerated());
                map.put("taskTitle", t.getTaskTitle() != null ? t.getTaskTitle() : "Untitled Task");
                map.put("kind", t.getKind() != null ? t.getKind() : "TASK");
                map.put("status", t.getStatus() != null ? t.getStatus().name() : "TODO");
                map.put("isOther", false);
                result.add(map);
            }
        }

        // Assigned Bugs
        List<AssignBug> bugs = bugRepository.findByAssignedTo_Id(userId);
        for (AssignBug b : bugs) {
            if (targetProject.equalsIgnoreCase(b.getProject())) {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("taskId", b.getId());
                map.put("taskCode", b.codeOrGenerated());
                map.put("taskTitle", b.getTaskTitle() != null ? b.getTaskTitle() : "Untitled Bug");
                map.put("kind", "BUG");
                map.put("status", b.getStatus() != null ? b.getStatus().name() : "TODO");
                map.put("isOther", false);
                result.add(map);
            }
        }

        // QA Testing assigned tasks
        taskRepository.findAll().stream()
                .filter(t -> targetProject.equalsIgnoreCase(t.getProject()))
                .filter(t -> Objects.equals(t.getAssignedTesterId(), userId) || (t.getAssignedTesterEmail() != null && t.getAssignedTesterEmail().equalsIgnoreCase(email)))
                .filter(t -> result.stream().noneMatch(existing -> Objects.equals(existing.get("taskId"), t.getId()) && "TASK".equalsIgnoreCase(String.valueOf(existing.get("kind")))))
                .forEach(t -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("taskId", t.getId());
                    map.put("taskCode", t.codeOrGenerated());
                    map.put("taskTitle", (t.getTaskTitle() != null ? t.getTaskTitle() : "Untitled Task") + " (QA Testing)");
                    map.put("kind", "TASK");
                    map.put("status", t.getTestingStatus() != null ? t.getTestingStatus() : "TESTING");
                    map.put("isOther", false);
                    result.add(map);
                });

        return result;
    }

    /** Returns reporting person information for current user. */
    public Map<String, Object> getReportingPerson(Authentication authentication) {
        String email = AuthContext.email(authentication);
        UserEntity employee = userRepository.findByEmailIgnoreCase(email).orElse(null);
        Map<String, Object> info = new HashMap<>();

        if (employee != null) {
            DailyTimesheet dummy = new DailyTimesheet();
            resolveReportingPerson(dummy, employee);
            info.put("reportingPersonEmail", dummy.getReportingPersonEmail());
            info.put("reportingPersonName", dummy.getReportingPersonName());
            info.put("employeeRole", employee.getRole());
            info.put("employeeName", employee.getName());
            info.put("employeeEmail", employee.getEmail());
        }
        return info;
    }

    /** Summary stats for Employee Timesheet Dashboard. */
    public Map<String, Object> getSummaryMetrics(Authentication authentication) {
        String email = AuthContext.email(authentication);
        List<DailyTimesheet> mySheets = dailyRepository.findByEmployeeEmailIgnoreCaseOrderByWorkDateDesc(email);

        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        double todayHours = 0.0;
        double weekHours = 0.0;
        int pendingCount = 0;
        int approvedCount = 0;
        int rejectedCount = 0;
        int draftCount = 0;

        for (DailyTimesheet s : mySheets) {
            double h = s.getTotalHours() != null ? s.getTotalHours() : 0.0;
            if (today.equals(s.getWorkDate())) {
                todayHours += h;
            }
            if (!s.getWorkDate().isBefore(monday) && !s.getWorkDate().isAfter(today)) {
                weekHours += h;
            }
            String st = s.getStatus() != null ? s.getStatus().toUpperCase(Locale.ROOT) : "";
            if ("SUBMITTED".equals(st) || "PENDING".equals(st) || "UNDER_REVIEW".equals(st)) {
                pendingCount++;
            } else if ("APPROVED".equals(st)) {
                approvedCount++;
            } else if ("REJECTED".equals(st)) {
                rejectedCount++;
            } else if ("DRAFT".equals(st)) {
                draftCount++;
            }
        }

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("todayHours", Math.round(todayHours * 10.0) / 10.0);
        metrics.put("weekHours", Math.round(weekHours * 10.0) / 10.0);
        metrics.put("pendingCount", pendingCount);
        metrics.put("approvedCount", approvedCount);
        metrics.put("rejectedCount", rejectedCount);
        metrics.put("draftCount", draftCount);
        metrics.put("totalSheets", mySheets.size());
        return metrics;
    }

    /**
     * Timesheet reports for Administrators and Team Leads.
     */
    public Map<String, Object> getReports(Authentication authentication,
                                         String employee,
                                         String project,
                                         LocalDate fromDate,
                                         LocalDate toDate,
                                         String status) {
        if (!AuthContext.isManager(authentication)) {
            throw new AccessDeniedException("Only team leads and administrators can view timesheet reports.");
        }

        List<DailyTimesheet> all = dailyRepository.findAll().stream()
                .filter(s -> status == null || status.equalsIgnoreCase("ALL") || status.equalsIgnoreCase(s.getStatus()))
                .filter(s -> employee == null || employee.trim().isEmpty() || employee.equalsIgnoreCase("ALL")
                        || (s.getEmployeeEmail() != null && s.getEmployeeEmail().equalsIgnoreCase(employee.trim()))
                        || (s.getEmployeeName() != null && s.getEmployeeName().equalsIgnoreCase(employee.trim())))
                .filter(s -> fromDate == null || !s.getWorkDate().isBefore(fromDate))
                .filter(s -> toDate == null || !s.getWorkDate().isAfter(toDate))
                .filter(s -> {
                    if (project == null || project.trim().isEmpty() || project.equalsIgnoreCase("ALL")) return true;
                    return s.getEntries().stream().anyMatch(e -> project.equalsIgnoreCase(e.getProject()));
                })
                .collect(Collectors.toList());

        // Employee-wise aggregation
        Map<String, Map<String, Object>> employeeSummary = new LinkedHashMap<>();
        for (DailyTimesheet s : all) {
            String empKey = s.getEmployeeName() != null ? s.getEmployeeName() : s.getEmployeeEmail();
            Map<String, Object> row = employeeSummary.computeIfAbsent(empKey, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("employeeName", k);
                m.put("employeeEmail", s.getEmployeeEmail());
                m.put("employeeRole", s.getEmployeeRole());
                m.put("totalHours", 0.0);
                m.put("approvedHours", 0.0);
                m.put("submittedHours", 0.0);
                m.put("timesheetCount", 0);
                return m;
            });

            double h = s.getTotalHours() != null ? s.getTotalHours() : 0.0;
            row.put("totalHours", Math.round(((Double) row.get("totalHours") + h) * 10.0) / 10.0);
            row.put("timesheetCount", (Integer) row.get("timesheetCount") + 1);

            if ("APPROVED".equalsIgnoreCase(s.getStatus())) {
                row.put("approvedHours", Math.round(((Double) row.get("approvedHours") + h) * 10.0) / 10.0);
            } else if ("SUBMITTED".equalsIgnoreCase(s.getStatus()) || "PENDING".equalsIgnoreCase(s.getStatus())) {
                row.put("submittedHours", Math.round(((Double) row.get("submittedHours") + h) * 10.0) / 10.0);
            }
        }

        // Project-wise aggregation
        Map<String, Map<String, Object>> projectSummary = new LinkedHashMap<>();
        for (DailyTimesheet s : all) {
            for (DailyTimesheetItem item : s.getEntries()) {
                if (project != null && !project.equalsIgnoreCase("ALL") && !project.equalsIgnoreCase(item.getProject())) {
                    continue;
                }
                String projKey = item.getProject() != null ? item.getProject() : "General";
                Map<String, Object> row = projectSummary.computeIfAbsent(projKey, k -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("project", k);
                    m.put("totalHours", 0.0);
                    m.put("taskCount", 0);
                    return m;
                });
                double h = item.getHours() != null ? item.getHours() : 0.0;
                row.put("totalHours", Math.round(((Double) row.get("totalHours") + h) * 10.0) / 10.0);
                row.put("taskCount", (Integer) row.get("taskCount") + 1);
            }
        }

        double grandTotal = all.stream().mapToDouble(s -> s.getTotalHours() != null ? s.getTotalHours() : 0.0).sum();

        Map<String, Object> response = new HashMap<>();
        response.put("grandTotalHours", Math.round(grandTotal * 10.0) / 10.0);
        response.put("totalTimesheets", all.size());
        response.put("employeeSummary", new ArrayList<>(employeeSummary.values()));
        response.put("projectSummary", new ArrayList<>(projectSummary.values()));
        return response;
    }
}
