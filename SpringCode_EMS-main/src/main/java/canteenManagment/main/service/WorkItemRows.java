package canteenManagment.main.service;

import canteenManagment.main.UserEntity.ApprovalState;
import canteenManagment.main.UserEntity.AssignTask;
import canteenManagment.main.UserEntity.WorkStatus;

/**
 * The one place a stored assignment is turned into the detached row the Angular
 * client reads.
 *
 * <p>The stored document embeds the owner's whole account, password hash
 * included, so it must never leave the server as-is. Every read endpoint goes
 * through {@link #of(AssignTask)} instead: the owner arrives as a plain name,
 * the lifecycle is filled in for rows written before it existed, and the task
 * code is always present - stored on new rows, derived from the id on old
 * ones.</p>
 */
public final class WorkItemRows {

    /** "BUG" or "PRODUCTION_ISSUE" are the other values; anything else reads as a task. */
    public static final String KIND_TASK = "TASK";
    public static final String KIND_BUG = "BUG";
    public static final String KIND_PRODUCTION_ISSUE = "PRODUCTION_ISSUE";

    private WorkItemRows() {
    }

    public static AssignTask of(AssignTask task) {
        AssignTask row = new AssignTask(
                task.getId(),
                task.getProject(),
                task.getTaskTitle(),
                null,
                task.getStartDate(),
                task.getEndDate(),
                task.getPriority(),
                task.getModule(),
                task.getSubModule(),
                task.getScreen(),
                task.getDescription(),
                task.getAttachmentPath(),
                task.getAssignedTo() != null ? task.getAssignedTo().getName() : null);

        // Legacy rows have no status yet; the boards render them as TODO.
        row.setStatus(task.getStatus() == null ? WorkStatus.TODO : task.getStatus());
        // The rework trail travels with the row so the card can show it.
        row.setReopenCount(task.getReopenCount());
        row.setLastReopenNote(task.getLastReopenNote());

        // The workflow trail: the code is what every screen shows, so it is
        // filled in even for rows created before the intake existed.
        row.setTaskCode(task.codeOrGenerated());
        row.setKind(kindOf(task));
        row.setApprovalState(ApprovalState.orDefault(task.getApprovalState()));
        row.setCreatedById(task.getCreatedById());
        row.setCreatedBy(task.getCreatedBy());
        row.setCreatedByName(task.getCreatedByName());
        row.setCreatedAt(task.getCreatedAt());
        row.setReviewedBy(task.getReviewedBy());
        row.setReviewedAt(task.getReviewedAt());
        row.setReviewNote(task.getReviewNote());
        row.setAssignedBy(task.getAssignedBy());
        row.setAssignedAt(task.getAssignedAt());
        row.setAssignedToId(task.getAssignedTo() == null ? null : task.getAssignedTo().getId());

        // Developer Team Leader draft notes / supplementary information
        row.setLeadNotes(task.getLeadNotes());
        row.setLeadNotesUpdatedBy(task.getLeadNotesUpdatedBy());
        row.setLeadNotesUpdatedAt(task.getLeadNotesUpdatedAt());

        // Tester Team Leader approval reversal details
        row.setReversalReason(task.getReversalReason());
        row.setRevertedBy(task.getRevertedBy());
        row.setRevertedAt(task.getRevertedAt());
        row.setReversalCount(task.getReversalCount());

        // Bug reproduction flow & steps
        row.setReproductionSteps(task.getReproductionSteps());
        row.setReproductionStepsImage(task.getReproductionStepsImage());
        row.setReproductionFlow(task.getReproductionFlow());

        // Developer Team Leader release for testing
        row.setReleasedForTesting(task.getReleasedForTesting());
        row.setReleasedBy(task.getReleasedBy());
        row.setReleasedByName(task.getReleasedByName());
        row.setReleasedAt(task.getReleasedAt());
        row.setReleaseNote(task.getReleaseNote());

        // Testing Team Leader assignment to tester
        row.setAssignedTesterId(task.getAssignedTester() != null ? task.getAssignedTester().getId() : task.getAssignedTesterId());
        row.setAssignedTesterName(task.getAssignedTester() != null ? task.getAssignedTester().getName() : task.getAssignedTesterName());
        row.setAssignedTesterEmail(task.getAssignedTester() != null ? task.getAssignedTester().getEmail() : task.getAssignedTesterEmail());
        row.setAssignedTesterAt(task.getAssignedTesterAt());
        row.setAssignedTesterBy(task.getAssignedTesterBy());
        row.setTestingInstructions(task.getTestingInstructions());
        row.setTestingStatus(task.getTestingStatus());

        // Tester verification outcome
        row.setVerifiedAt(task.getVerifiedAt());
        row.setVerifiedBy(task.getVerifiedBy());
        row.setVerificationNote(task.getVerificationNote());

        // Team Leader review & hold status before QA release
        row.setLeadReviewStatus(task.getLeadReviewStatus());
        row.setLeadReviewedBy(task.getLeadReviewedBy());
        row.setLeadReviewedByName(task.getLeadReviewedByName());
        row.setLeadReviewedAt(task.getLeadReviewedAt());
        row.setHoldReason(task.getHoldReason());
        row.setHeldAt(task.getHeldAt());
        row.setHeldBy(task.getHeldBy());
        row.setHeldByName(task.getHeldByName());
        return row;
    }

    /** Trimmed upper-case kind, defaulting to a task. */
    public static String kindOf(AssignTask task) {
        String stored = task.getKind() == null ? "" : task.getKind().trim().toUpperCase();
        if (KIND_PRODUCTION_ISSUE.equals(stored) || "PROD_ISSUE".equals(stored) || "PROD".equals(stored)) {
            return KIND_PRODUCTION_ISSUE;
        }
        return KIND_BUG.equals(stored) ? KIND_BUG : KIND_TASK;
    }
}
