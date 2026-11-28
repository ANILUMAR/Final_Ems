package canteenManagment.main.controller;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import canteenManagment.main.UserEntity.DailyTimesheet;
import canteenManagment.main.UserEntity.TimesheetEntry;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.reference.ReferenceService;
import canteenManagment.main.security.AuthContext;
import canteenManagment.main.security.Roles;
import canteenManagment.main.service.TimesheetService;
import canteenManagment.main.userReposerity.UserRepository;

@RestController
@RequestMapping("/api/timesheets")
public class TimesheetController {

    @Autowired
    private TimesheetService service;

    @Autowired
    private ReferenceService referenceService;

    @Autowired
    private UserRepository userRepository;

    /* =========================================================================
     * DAILY TASK-WISE TIMESHEET ENDPOINTS
     * ========================================================================= */

    /**
     * Creates or updates a daily task-wise timesheet.
     * Pass ?submit=true to submit for approval, or submit=false to save as draft.
     */
    @PostMapping("/daily")
    public ResponseEntity<?> saveDaily(@RequestBody DailyTimesheet timesheet,
                                       @RequestParam(defaultValue = "false") boolean submit,
                                       Authentication authentication) {
        try {
            DailyTimesheet saved = service.saveDailyTimesheet(timesheet, authentication, submit);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to save timesheet: " + e.getMessage()));
        }
    }

    /**
     * Gets the current employee's historical daily timesheets with filters.
     */
    @GetMapping("/daily/my")
    public ResponseEntity<?> getMyTimesheets(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String project,
            @RequestParam(required = false) String status,
            Authentication authentication) {
        try {
            List<DailyTimesheet> list = service.getMyTimesheets(authentication, fromDate, toDate, project, status);
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * Gets a single daily timesheet by ID.
     */
    @GetMapping("/daily/{id}")
    public ResponseEntity<?> getDailyById(@PathVariable String id, Authentication authentication) {
        try {
            return ResponseEntity.ok(service.getById(id, authentication));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * Approvals dashboard for Reporting Persons, Team Leads, and Admins.
     */
    @GetMapping("/daily/approvals")
    public ResponseEntity<?> getApprovalsQueue(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String employee,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            Authentication authentication) {
        try {
            List<DailyTimesheet> queue = service.getApprovalsQueue(authentication, status, employee, fromDate, toDate);
            return ResponseEntity.ok(queue);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * Approves a daily timesheet.
     */
    @PostMapping("/daily/{id}/approve")
    public ResponseEntity<?> approveDaily(@PathVariable String id, Authentication authentication) {
        try {
            DailyTimesheet approved = service.approveTimesheet(id, authentication);
            return ResponseEntity.ok(approved);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * Rejects a daily timesheet with mandatory reason.
     */
    @PostMapping("/daily/{id}/reject")
    public ResponseEntity<?> rejectDaily(@PathVariable String id,
                                         @RequestBody Map<String, String> payload,
                                         Authentication authentication) {
        String rejectionReason = payload != null ? payload.get("rejectionReason") : null;
        try {
            DailyTimesheet rejected = service.rejectTimesheet(id, rejectionReason, authentication);
            return ResponseEntity.ok(rejected);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * Sets timesheet status to Under Review.
     */
    @PostMapping("/daily/{id}/under-review")
    public ResponseEntity<?> markUnderReview(@PathVariable String id, Authentication authentication) {
        try {
            return ResponseEntity.ok(service.markUnderReview(id, authentication));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * Returns assigned tasks, tickets, and bugs for the logged in employee for a specific project.
     */
    @GetMapping("/daily/my-tasks-for-project")
    public ResponseEntity<?> getMyTasksForProject(@RequestParam String project, Authentication authentication) {
        try {
            return ResponseEntity.ok(service.getMyTasksForProject(project, authentication));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Returns reporting person info for the logged in user.
     */
    @GetMapping("/daily/reporting-person")
    public ResponseEntity<?> getReportingPerson(Authentication authentication) {
        try {
            return ResponseEntity.ok(service.getReportingPerson(authentication));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Summary cards for the employee dashboard (today's hours, week's hours, pending, approved, rejected).
     */
    @GetMapping("/daily/summary")
    public ResponseEntity<?> getSummaryMetrics(Authentication authentication) {
        try {
            return ResponseEntity.ok(service.getSummaryMetrics(authentication));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Reports for Admins and Team Leads.
     */
    @GetMapping("/daily/reports")
    public ResponseEntity<?> getReports(
            @RequestParam(required = false) String employee,
            @RequestParam(required = false) String project,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String status,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(service.getReports(authentication, employee, project, fromDate, toDate, status));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        }
    }

    /* =========================================================================
     * LEGACY ENDPOINTS (Preserved for backwards compatibility)
     * ========================================================================= */

    @GetMapping
    public List<TimesheetEntry> getAll(Authentication authentication) {
        List<TimesheetEntry> entries = service.getAll();

        if (AuthContext.isAdmin(authentication)) {
            return entries;
        }

        Set<String> owners = AuthContext.isLead(authentication)
                ? familyOwners(AuthContext.email(authentication))
                : Collections.singleton(AuthContext.email(authentication).toLowerCase(Locale.ROOT));

        return entries.stream()
                .filter(entry -> entry.getEmployeeName() != null
                        && owners.contains(entry.getEmployeeName().trim().toLowerCase(Locale.ROOT)))
                .collect(Collectors.toList());
    }

    private Set<String> familyOwners(String email) {
        Optional<UserEntity> caller = userRepository.findByEmailIgnoreCase(email);
        if (caller.isPresent() && Roles.isTeamLead(caller.get().getRole())) {
            return userRepository.findAll().stream()
                    .flatMap(user -> Stream.of(user.getEmail(), user.getName()))
                    .filter(Objects::nonNull)
                    .map(owner -> owner.trim().toLowerCase(Locale.ROOT))
                    .filter(owner -> !owner.isEmpty())
                    .collect(Collectors.toSet());
        }
        String family = caller.map(user -> Roles.family(user.getRole())).orElse("");
        if (family.isEmpty()) {
            return Collections.emptySet();
        }
        return userRepository.findAll().stream()
                .filter(user -> family.equals(Roles.family(user.getRole())))
                .flatMap(user -> Stream.of(user.getEmail(), user.getName()))
                .filter(Objects::nonNull)
                .map(owner -> owner.trim().toLowerCase(Locale.ROOT))
                .filter(owner -> !owner.isEmpty())
                .collect(Collectors.toSet());
    }

    @PostMapping
    public TimesheetEntry save(@RequestBody TimesheetEntry entry, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication)) {
            entry.setEmployeeName(AuthContext.email(authentication));
        }
        entry.setId(null);
        entry.setStatus(resolveStatus(entry.getStatus()));
        return service.save(entry);
    }

    private String resolveStatus(String requested) {
        String value = requested == null ? "" : requested.trim();
        if (!value.isEmpty()) {
            if (!referenceService.isActiveCode(ReferenceService.TIMESHEET_STATUS, value)) {
                throw new IllegalArgumentException("Unknown timesheet status: " + requested);
            }
            return value.toUpperCase(Locale.ROOT);
        }
        List<String> codes = referenceService.codes(ReferenceService.TIMESHEET_STATUS);
        return codes.isEmpty() ? null : codes.get(0);
    }
}
