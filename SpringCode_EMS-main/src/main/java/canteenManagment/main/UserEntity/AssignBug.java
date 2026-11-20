package canteenManagment.main.UserEntity;

import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Bug items are stored in a dedicated database collection (table) "AssignBug",
 * keeping Tasks and Bugs completely separated with independent ID sequences starting from 01.
 */
@Document(collection = "AssignBug")
public class AssignBug extends AssignTask {

    public AssignBug() {
        super();
        setKind("BUG");
    }

    public AssignBug(Long id, String project, String taskTitle, UserEntity assignedTo, java.util.Date startDate,
            java.util.Date endDate, String priority, String module, String subModule, String screen,
            String description, String attachmentPath, String assignedToName) {
        super(id, project, taskTitle, assignedTo, startDate, endDate, priority, module, subModule, screen, description,
                attachmentPath, assignedToName);
        setKind("BUG");
    }

    public static AssignBug fromTask(AssignTask task) {
        if (task == null) {
            return null;
        }
        AssignBug bug = new AssignBug();
        bug.setId(task.getId());
        bug.setTaskCode(task.getTaskCode());
        bug.setKind("BUG");
        bug.setProject(task.getProject());
        bug.setTaskTitle(task.getTaskTitle());
        bug.setAssignedTo(task.getAssignedTo());
        bug.setStartDate(task.getStartDate());
        bug.setEndDate(task.getEndDate());
        bug.setPriority(task.getPriority());
        bug.setStatus(task.getStatus());
        bug.setModule(task.getModule());
        bug.setSubModule(task.getSubModule());
        bug.setScreen(task.getScreen());
        bug.setDescription(task.getDescription());
        bug.setAttachmentPath(task.getAttachmentPath());
        bug.setAssignedBy(task.getAssignedBy());
        bug.setAssignedAt(task.getAssignedAt());
        bug.setReopenCount(task.getReopenCount());
        bug.setLastReopenNote(task.getLastReopenNote());
        bug.setApprovalState(task.getApprovalState());
        bug.setCreatedById(task.getCreatedById());
        bug.setCreatedBy(task.getCreatedBy());
        bug.setCreatedByName(task.getCreatedByName());
        bug.setCreatedAt(task.getCreatedAt());
        bug.setReviewedBy(task.getReviewedBy());
        bug.setReviewedAt(task.getReviewedAt());
        bug.setReviewNote(task.getReviewNote());
        bug.setLeadNotes(task.getLeadNotes());
        bug.setLeadNotesUpdatedBy(task.getLeadNotesUpdatedBy());
        bug.setLeadNotesUpdatedAt(task.getLeadNotesUpdatedAt());
        bug.setReversalReason(task.getReversalReason());
        bug.setRevertedBy(task.getRevertedBy());
        bug.setRevertedAt(task.getRevertedAt());
        bug.setReversalCount(task.getReversalCount());
        bug.setReproductionSteps(task.getReproductionSteps());
        bug.setReproductionStepsImage(task.getReproductionStepsImage());
        bug.setReproductionFlow(task.getReproductionFlow());
        bug.setReleasedForTesting(task.getReleasedForTesting());
        bug.setReleasedBy(task.getReleasedBy());
        bug.setReleasedByName(task.getReleasedByName());
        bug.setReleasedAt(task.getReleasedAt());
        bug.setReleaseNote(task.getReleaseNote());
        bug.setAssignedTester(task.getAssignedTester());
        bug.setAssignedTesterId(task.getAssignedTesterId());
        bug.setAssignedTesterName(task.getAssignedTesterName());
        bug.setAssignedTesterEmail(task.getAssignedTesterEmail());
        bug.setAssignedTesterAt(task.getAssignedTesterAt());
        bug.setAssignedTesterBy(task.getAssignedTesterBy());
        bug.setTestingInstructions(task.getTestingInstructions());
        bug.setTestingStatus(task.getTestingStatus());
        bug.setVerifiedAt(task.getVerifiedAt());
        bug.setVerifiedBy(task.getVerifiedBy());
        bug.setVerificationNote(task.getVerificationNote());
        bug.setLeadReviewStatus(task.getLeadReviewStatus());
        bug.setLeadReviewedBy(task.getLeadReviewedBy());
        bug.setLeadReviewedByName(task.getLeadReviewedByName());
        bug.setLeadReviewedAt(task.getLeadReviewedAt());
        bug.setHoldReason(task.getHoldReason());
        bug.setHeldAt(task.getHeldAt());
        bug.setHeldBy(task.getHeldBy());
        bug.setHeldByName(task.getHeldByName());
        return bug;
    }
}
