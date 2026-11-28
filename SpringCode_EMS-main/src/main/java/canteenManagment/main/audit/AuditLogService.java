package canteenManagment.main.audit;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import canteenManagment.main.UserEntity.DailyTimesheet;
import canteenManagment.main.UserEntity.DeletedTask;
import canteenManagment.main.UserEntity.StatusChange;
import canteenManagment.main.UserEntity.TimesheetAudit;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.UserEntity.WorkStatus;
import canteenManagment.main.userReposerity.DailyTimesheetRepository;
import canteenManagment.main.userReposerity.DeletedTaskRepository;
import canteenManagment.main.userReposerity.StatusChangeRepository;
import canteenManagment.main.userReposerity.UserRepository;

@Service
public class AuditLogService {

    private final StatusChangeRepository statusChangeRepository;
    private final DeletedTaskRepository deletedTaskRepository;
    private final DailyTimesheetRepository dailyTimesheetRepository;
    private final UserRepository userRepository;

    public AuditLogService(
            StatusChangeRepository statusChangeRepository,
            DeletedTaskRepository deletedTaskRepository,
            DailyTimesheetRepository dailyTimesheetRepository,
            UserRepository userRepository) {
        this.statusChangeRepository = statusChangeRepository;
        this.deletedTaskRepository = deletedTaskRepository;
        this.dailyTimesheetRepository = dailyTimesheetRepository;
        this.userRepository = userRepository;
    }

    /**
     * Builds and aggregates a unified stream of all system transactions, activities,
     * status updates, ticket deletions, and timesheet lifecycle events.
     */
    public List<AuditLogItemDTO> getAuditLogs(String category, String search, String fromDate, String toDate) {
        List<AuditLogItemDTO> items = new ArrayList<>();

        // Cache user roles for fast O(1) enrichment
        Map<String, String> userRoleMap = new HashMap<>();
        Map<String, String> userNameMap = new HashMap<>();
        try {
            List<UserEntity> users = userRepository.findAll();
            for (UserEntity u : users) {
                if (u.getEmail() != null) {
                    String emailKey = u.getEmail().trim().toLowerCase();
                    userRoleMap.put(emailKey, u.getRole() != null ? u.getRole() : "User");
                    userNameMap.put(emailKey, u.getName() != null ? u.getName() : u.getEmail());
                }
            }
        } catch (Exception ignored) {}

        // 1. Ingest Status Transitions (status_history)
        try {
            List<StatusChange> statusChanges = statusChangeRepository.findAll();
            for (StatusChange sc : statusChanges) {
                AuditLogItemDTO item = new AuditLogItemDTO();
                item.setId("SC-" + sc.getId());
                item.setCategory("STATUS_CHANGE");
                String from = sc.getFromStatus() != null ? sc.getFromStatus().name() : "INIT";
                String to = sc.getToStatus() != null ? sc.getToStatus().name() : "UPDATED";
                item.setAction("Status updated: " + from + " ➔ " + to);
                item.setEntityType(sc.getEntityType() != null ? sc.getEntityType() : "TASK");
                item.setEntityId(sc.getEntityId() != null ? String.valueOf(sc.getEntityId()) : "");
                item.setEntityTitle(sc.getEntityTitle() != null ? sc.getEntityTitle() : "Ticket #" + sc.getEntityId());
                item.setActorEmail(sc.getActorEmail());
                item.setActorName(sc.getActorName() != null ? sc.getActorName() : userNameMap.getOrDefault(sc.getActorEmail() != null ? sc.getActorEmail().toLowerCase() : "", sc.getActorEmail()));
                item.setActorRole(userRoleMap.getOrDefault(sc.getActorEmail() != null ? sc.getActorEmail().toLowerCase() : "", "Member"));
                item.setFromValue(from);
                item.setToValue(to);
                item.setDetails("Transitioned " + item.getEntityTitle() + " from [" + from + "] to [" + to + "]");
                item.setRemarks(sc.getNote());
                item.setTimestamp(sc.getChangedAt() != null ? sc.getChangedAt() : new Date());

                if (sc.getToStatus() == WorkStatus.DONE) {
                    item.setSeverity("SUCCESS");
                } else if (sc.getFromStatus() == WorkStatus.DONE && sc.getToStatus() != WorkStatus.DONE) {
                    item.setSeverity("WARNING"); // Reopened
                } else {
                    item.setSeverity("INFO");
                }
                items.add(item);
            }
        } catch (Exception ignored) {}

        // 2. Ingest Ticket Deletions (deleted_task)
        try {
            List<DeletedTask> deletedTasks = deletedTaskRepository.findAll();
            for (DeletedTask dt : deletedTasks) {
                AuditLogItemDTO item = new AuditLogItemDTO();
                item.setId("DEL-" + dt.getId());
                item.setCategory("TICKET_DELETION");
                String kind = dt.getKind() != null ? dt.getKind() : "TASK";
                item.setAction("Deleted " + kind + ": " + (dt.getTaskCode() != null ? dt.getTaskCode() + " " : "") + (dt.getTaskName() != null ? dt.getTaskName() : ""));
                item.setEntityType(kind);
                item.setEntityId(dt.getTaskId() != null ? String.valueOf(dt.getTaskId()) : "");
                item.setEntityCode(dt.getTaskCode());
                item.setEntityTitle(dt.getTaskName() != null ? dt.getTaskName() : "Untitled Ticket");
                item.setActorEmail(dt.getDeletedBy());
                item.setActorName(userNameMap.getOrDefault(dt.getDeletedBy() != null ? dt.getDeletedBy().toLowerCase() : "", dt.getDeletedBy()));
                item.setActorRole(userRoleMap.getOrDefault(dt.getDeletedBy() != null ? dt.getDeletedBy().toLowerCase() : "", "Admin"));
                item.setFromValue("ACTIVE");
                item.setToValue("DELETED");
                item.setDetails("Permanent removal from active ticket registry (" + (dt.getTaskCode() != null ? dt.getTaskCode() : "ID " + dt.getTaskId()) + ")");
                item.setRemarks(dt.getReason());
                item.setSeverity("DANGER");

                if (dt.getDeletedDate() != null) {
                    item.setTimestamp(Date.from(dt.getDeletedDate().atZone(ZoneId.systemDefault()).toInstant()));
                } else {
                    item.setTimestamp(new Date());
                }
                items.add(item);
            }
        } catch (Exception ignored) {}

        // 3. Ingest Timesheet Lifecycle & Approvals (daily_timesheets)
        try {
            List<DailyTimesheet> timesheets = dailyTimesheetRepository.findAll();
            for (DailyTimesheet sheet : timesheets) {
                if (sheet.getHistory() != null && !sheet.getHistory().isEmpty()) {
                    for (int i = 0; i < sheet.getHistory().size(); i++) {
                        TimesheetAudit audit = sheet.getHistory().get(i);
                        AuditLogItemDTO item = new AuditLogItemDTO();
                        long tsTime = audit.getTimestamp() != null ? audit.getTimestamp().getTime() : 0L;
                        item.setId("TS-" + sheet.getId() + "-" + i + "-" + tsTime);
                        item.setCategory("TIMESHEET");
                        String action = audit.getAction() != null ? audit.getAction() : "UPDATED";
                        item.setAction("Timesheet " + action + " for " + (sheet.getEmployeeName() != null ? sheet.getEmployeeName() : "Employee"));
                        item.setEntityType("TIMESHEET");
                        item.setEntityId(sheet.getId());
                        item.setEntityTitle((sheet.getEmployeeName() != null ? sheet.getEmployeeName() : "Timesheet") + " — " + (sheet.getWorkDate() != null ? sheet.getWorkDate().toString() : "Date") + " (" + (sheet.getTotalHours() != null ? sheet.getTotalHours() : 0.0) + "h)");
                        item.setActorEmail(audit.getPerformedBy());
                        item.setActorName(audit.getPerformedByName() != null ? audit.getPerformedByName() : userNameMap.getOrDefault(audit.getPerformedBy() != null ? audit.getPerformedBy().toLowerCase() : "", audit.getPerformedBy()));
                        item.setActorRole(userRoleMap.getOrDefault(audit.getPerformedBy() != null ? audit.getPerformedBy().toLowerCase() : "", "Member"));
                        item.setFromValue("");
                        item.setToValue(action);
                        item.setDetails("Timesheet record (" + (sheet.getWorkDate() != null ? sheet.getWorkDate().toString() : "") + ") moved to " + action);
                        item.setRemarks(audit.getComment() != null ? audit.getComment() : sheet.getRejectionReason());

                        if ("APPROVED".equalsIgnoreCase(action)) {
                            item.setSeverity("SUCCESS");
                        } else if ("REJECTED".equalsIgnoreCase(action)) {
                            item.setSeverity("DANGER");
                        } else {
                            item.setSeverity("INFO");
                        }
                        item.setTimestamp(audit.getTimestamp() != null ? audit.getTimestamp() : (sheet.getSubmittedAt() != null ? sheet.getSubmittedAt() : new Date()));
                        items.add(item);
                    }
                }
            }
        } catch (Exception ignored) {}

        // Sort descending by timestamp (newest transactions first)
        items.sort(Comparator.comparing(AuditLogItemDTO::getTimestamp, Comparator.nullsLast(Comparator.reverseOrder())));

        // Apply filters
        return items.stream()
                .filter(item -> {
                    // Category filter
                    if (category != null && !category.trim().isEmpty() && !"ALL".equalsIgnoreCase(category.trim())) {
                        if (!category.trim().equalsIgnoreCase(item.getCategory())) {
                            return false;
                        }
                    }
                    // Search filter
                    if (search != null && !search.trim().isEmpty()) {
                        String s = search.trim().toLowerCase();
                        boolean match = (item.getAction() != null && item.getAction().toLowerCase().contains(s))
                                || (item.getActorName() != null && item.getActorName().toLowerCase().contains(s))
                                || (item.getActorEmail() != null && item.getActorEmail().toLowerCase().contains(s))
                                || (item.getEntityTitle() != null && item.getEntityTitle().toLowerCase().contains(s))
                                || (item.getEntityCode() != null && item.getEntityCode().toLowerCase().contains(s))
                                || (item.getDetails() != null && item.getDetails().toLowerCase().contains(s))
                                || (item.getRemarks() != null && item.getRemarks().toLowerCase().contains(s));
                        if (!match) return false;
                    }
                    // Date filters
                    if (fromDate != null && !fromDate.trim().isEmpty() && item.getTimestamp() != null) {
                        try {
                            LocalDate f = LocalDate.parse(fromDate.trim(), DateTimeFormatter.ISO_DATE);
                            Date fromD = Date.from(f.atStartOfDay(ZoneId.systemDefault()).toInstant());
                            if (item.getTimestamp().before(fromD)) return false;
                        } catch (Exception ignored) {}
                    }
                    if (toDate != null && !toDate.trim().isEmpty() && item.getTimestamp() != null) {
                        try {
                            LocalDate t = LocalDate.parse(toDate.trim(), DateTimeFormatter.ISO_DATE);
                            Date toD = Date.from(t.atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant());
                            if (item.getTimestamp().after(toD)) return false;
                        } catch (Exception ignored) {}
                    }
                    return true;
                })
                .collect(Collectors.toList());
    }

    /**
     * Computes high-level aggregated summary statistics for the audit header.
     */
    public AuditStatsDTO getStats() {
        List<AuditLogItemDTO> all = getAuditLogs("ALL", null, null, null);
        long total = all.size();
        long statusTransitions = all.stream().filter(i -> "STATUS_CHANGE".equalsIgnoreCase(i.getCategory())).count();
        long deletions = all.stream().filter(i -> "TICKET_DELETION".equalsIgnoreCase(i.getCategory())).count();
        long timesheets = all.stream().filter(i -> "TIMESHEET".equalsIgnoreCase(i.getCategory())).count();
        Set<String> uniqueActors = new HashSet<>();
        for (AuditLogItemDTO i : all) {
            if (i.getActorEmail() != null && !i.getActorEmail().trim().isEmpty()) {
                uniqueActors.add(i.getActorEmail().trim().toLowerCase());
            } else if (i.getActorName() != null && !i.getActorName().trim().isEmpty()) {
                uniqueActors.add(i.getActorName().trim().toLowerCase());
            }
        }
        return new AuditStatsDTO(total, statusTransitions, deletions, timesheets, uniqueActors.size());
    }
}
