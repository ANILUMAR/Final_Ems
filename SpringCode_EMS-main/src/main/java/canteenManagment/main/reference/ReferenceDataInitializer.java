package canteenManagment.main.reference;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Writes the default reference lists on first start.
 *
 * <p>This is a one-time baseline, not a fixture: a value is only inserted when
 * the collection has no row for it, so edits made through the admin API (a
 * renamed label, a retired status, a new priority) survive every restart.</p>
 */
@Component
@Order(1)
public class ReferenceDataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ReferenceDataInitializer.class);

    /** category, code, label, icon, tone, order */
    private static final List<LookupItem> BASELINE = Arrays.asList(
            // --- Roles, in dropdown order: the CEO, then each team with its
            // leader above its members. The code is the identity the guards
            // check; security/Roles maps it to a family (ADMIN / EMPLOYEE /
            // TESTER). ADMIN survives only so rows written before the split
            // still resolve - it is not offered when a role is picked.
            new LookupItem(ReferenceService.ROLE, "SUPER_ADMIN", "Super Admin", "workspace_premium", "warning", 5),
            new LookupItem(ReferenceService.ROLE, "ADMIN", "Admin", "shield_person", "info", 10),
            new LookupItem(ReferenceService.ROLE, "DEVELOPER_LEAD", "Java Team Leader", "groups", "info", 15),
            new LookupItem(ReferenceService.ROLE, "EMPLOYEE", "Java Developer", "code", "neutral", 20),
            new LookupItem(ReferenceService.ROLE, "TESTER_LEAD", "Tester Team Leader", "groups", "info", 25),
            new LookupItem(ReferenceService.ROLE, "TESTER", "Tester", "bug_report", "neutral", 30),

            // --- Lifecycle shared by tasks and assignments.
            new LookupItem(ReferenceService.WORK_STATUS, "TODO", "To do", "radio_button_unchecked", "neutral", 10),
            new LookupItem(ReferenceService.WORK_STATUS, "ASSIGNED", "Assigned", "assignment_ind", "info", 15),
            new LookupItem(ReferenceService.WORK_STATUS, "IN_PROGRESS", "In progress", "timelapse", "info", 20),
            new LookupItem(ReferenceService.WORK_STATUS, "IN_REVIEW", "In review", "rate_review", "warning", 30),
            new LookupItem(ReferenceService.WORK_STATUS, "DONE", "Done", "task_alt", "success", 40),

            // --- Priority: stored upper-case, shown title-case.
            new LookupItem(ReferenceService.PRIORITY, "HIGH", "High", "priority_high", "danger", 10),
            new LookupItem(ReferenceService.PRIORITY, "MEDIUM", "Medium", "drag_handle", "warning", 20),
            new LookupItem(ReferenceService.PRIORITY, "LOW", "Low", "low_priority", "neutral", 30),

            // --- Timesheet approval states. Approved and rejected are outcomes,
            // so they render on the list but are never offered as a choice when
            // somebody books hours.
            new LookupItem(ReferenceService.TIMESHEET_STATUS, "PENDING", "Pending approval", "hourglass_top", "warning", 10),
            new LookupItem(ReferenceService.TIMESHEET_STATUS, "DRAFT", "Draft", "edit_note", "neutral", 20),
            decision(ReferenceService.TIMESHEET_STATUS, "APPROVED", "Approved", "verified", "success", 30),
            decision(ReferenceService.TIMESHEET_STATUS, "REJECTED", "Rejected", "block", "danger", 40),

            // --- Project health shown on the project screens.
            new LookupItem(ReferenceService.PROJECT_STATUS, "NOT_STARTED", "Not started", "schedule", "neutral", 10),
            new LookupItem(ReferenceService.PROJECT_STATUS, "ON_TRACK", "On track", "trending_up", "info", 20),
            new LookupItem(ReferenceService.PROJECT_STATUS, "AT_RISK", "At risk", "warning", "warning", 30),
            new LookupItem(ReferenceService.PROJECT_STATUS, "COMPLETED", "Completed", "task_alt", "success", 40)
    );

    private final LookupRepository repository;

    public ReferenceDataInitializer(LookupRepository repository) {
        this.repository = repository;
    }

    /** A value that is displayed and stored, but never offered as a choice. */
    private static LookupItem decision(String category, String code, String label, String icon, String tone, int order) {
        LookupItem item = new LookupItem(category, code, label, icon, tone, order);
        item.setSelectable(Boolean.FALSE);
        return item;
    }

    @Override
    public void run(ApplicationArguments args) {
        int created = 0;
        int migrated = 0;
        for (LookupItem item : BASELINE) {
            Optional<LookupItem> existing = repository.findById(item.getId());
            if (existing.isEmpty()) {
                repository.save(item);
                created++;
                continue;
            }
            LookupItem stored = existing.get();
            boolean changed = false;
            // Rows written before `selectable` existed take the baseline flag
            // once. Anything already answered is left exactly as it is.
            if (stored.getSelectable() == null) {
                stored.setSelectable(item.getSelectable());
                changed = true;
            }
            if (ReferenceService.ROLE.equals(item.getCategory()) && !Objects.equals(stored.getLabel(), item.getLabel())) {
                stored.setLabel(item.getLabel());
                changed = true;
            }
            if (changed) {
                repository.save(stored);
                migrated++;
            }
        }
        long total = repository.count();
        if (created > 0 || migrated > 0) {
            log.info("Reference data: added {}, migrated {}; app_lookup now holds {}.", created, migrated, total);
        } else {
            log.info("Reference data already present ({} values).", total);
        }
    }
}
