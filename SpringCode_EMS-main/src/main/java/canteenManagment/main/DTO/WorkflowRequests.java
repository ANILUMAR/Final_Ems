package canteenManagment.main.DTO;

import org.springframework.web.multipart.MultipartFile;

/**
 * Request bodies for the approval workflow that sits between the testing team
 * and the developers.
 *
 * <p>Kept together in one file because they are four small shapes of the same
 * conversation: a tester raises an item, the testing team leader decides, the
 * tester corrects it, the developer team leader hands it out.</p>
 */
public final class WorkflowRequests {

    private WorkflowRequests() {
    }

    /** What a tester fills in on Raise task / bug. */
    public static class Submission {
        /** TASK or BUG; default TASK. */
        private String kind;
        private String project;
        private String taskTitle;
        /** The severity the tester saw; the developer leader may reset it later. */
        private String priority;
        private String module;
        private String subModule;
        private String screen;
        private String description;
        private MultipartFile attachment;
        private String reproductionSteps;
        private String reproductionFlow;
        private MultipartFile reproductionFlowImage;
        private String reproductionFlowImageBase64;

        public String getReproductionFlowImageBase64() {
            return reproductionFlowImageBase64;
        }

        public void setReproductionFlowImageBase64(String reproductionFlowImageBase64) {
            this.reproductionFlowImageBase64 = reproductionFlowImageBase64;
        }

        public String getReproductionSteps() {
            return reproductionSteps;
        }

        public void setReproductionSteps(String reproductionSteps) {
            this.reproductionSteps = reproductionSteps;
        }

        public String getReproductionFlow() {
            return reproductionFlow;
        }

        public void setReproductionFlow(String reproductionFlow) {
            this.reproductionFlow = reproductionFlow;
        }

        public MultipartFile getReproductionFlowImage() {
            return reproductionFlowImage;
        }

        public void setReproductionFlowImage(MultipartFile reproductionFlowImage) {
            this.reproductionFlowImage = reproductionFlowImage;
        }

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }

        public String getProject() {
            return project;
        }

        public void setProject(String project) {
            this.project = project;
        }

        public String getTaskTitle() {
            return taskTitle;
        }

        public void setTaskTitle(String taskTitle) {
            this.taskTitle = taskTitle;
        }

        public String getPriority() {
            return priority;
        }

        public void setPriority(String priority) {
            this.priority = priority;
        }

        public String getModule() {
            return module;
        }

        public void setModule(String module) {
            this.module = module;
        }

        public String getSubModule() {
            return subModule;
        }

        public void setSubModule(String subModule) {
            this.subModule = subModule;
        }

        public String getScreen() {
            return screen;
        }

        public void setScreen(String screen) {
            this.screen = screen;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public MultipartFile getAttachment() {
            return attachment;
        }

        public void setAttachment(MultipartFile attachment) {
            this.attachment = attachment;
        }
    }

    /** Approve or send back, always with the reason the tester will read. */
    public static class Review {
        /** APPROVE or REJECT (APPROVED / REJECTED are accepted too). */
        private String decision;
        private String note;
        private String kind;

        public String getDecision() {
            return decision;
        }

        public void setDecision(String decision) {
            this.decision = decision;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }
    }

    /** A tester's corrections after a rejection; every field is optional. */
    public static class Correction {
        private String kind;
        private String taskTitle;
        private String priority;
        private String module;
        private String subModule;
        private String screen;
        private String description;

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }

        public String getTaskTitle() {
            return taskTitle;
        }

        public void setTaskTitle(String taskTitle) {
            this.taskTitle = taskTitle;
        }

        public String getPriority() {
            return priority;
        }

        public void setPriority(String priority) {
            this.priority = priority;
        }

        public String getModule() {
            return module;
        }

        public void setModule(String module) {
            this.module = module;
        }

        public String getSubModule() {
            return subModule;
        }

        public void setSubModule(String subModule) {
            this.subModule = subModule;
        }

        public String getScreen() {
            return screen;
        }

        public void setScreen(String screen) {
            this.screen = screen;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }

    /** The developer team leader handing an approved item to a developer. */
    public static class Assignment {
        private Long developerId;
        private String priority;
        /** yyyy-MM-dd; the planned window, optional. */
        private String startDate;
        private String endDate;
        private String note;
        private String leadNotes;
        private String kind;

        public Long getDeveloperId() {
            return developerId;
        }

        public void setDeveloperId(Long developerId) {
            this.developerId = developerId;
        }

        public String getPriority() {
            return priority;
        }

        public void setPriority(String priority) {
            this.priority = priority;
        }

        public String getStartDate() {
            return startDate;
        }

        public void setStartDate(String startDate) {
            this.startDate = startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public void setEndDate(String endDate) {
            this.endDate = endDate;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }

        public String getLeadNotes() {
            return leadNotes;
        }

        public void setLeadNotes(String leadNotes) {
            this.leadNotes = leadNotes;
        }

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }
    }

    /** Developer Team Leader adding draft notes / supplementary information. */
    public static class LeadNotes {
        private String leadNotes;
        private String kind;

        public String getLeadNotes() {
            return leadNotes;
        }

        public void setLeadNotes(String leadNotes) {
            this.leadNotes = leadNotes;
        }

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }
    }

    /** Tester Team Leader reverting an approval with a mandatory reason. */
    public static class ApprovalReversal {
        private String reason;
        private String kind;

        public String getReason() {
            return reason;
        }

        public void setReason(String reason) {
            this.reason = reason;
        }

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }
    }

    /** Developer Team Leader releasing completed work for testing. */
    public static class ReleaseForTesting {
        private String note;
        private String kind;

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }
    }

    /** Testing Team Leader assigning released work to a tester. */
    public static class AssignTester {
        private Long testerId;
        private String priority;
        private String note;
        private String kind;

        public Long getTesterId() {
            return testerId;
        }

        public void setTesterId(Long testerId) {
            this.testerId = testerId;
        }

        public String getPriority() {
            return priority;
        }

        public void setPriority(String priority) {
            this.priority = priority;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }
    }

    /** Tester submitting verification test outcome. */
    public static class VerifyTest {
        private String result; // PASSED or FAILED
        private String note;
        private String kind;

        public String getResult() {
            return result;
        }

        public void setResult(String result) {
            this.result = result;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }
    }

    /** Team Leader review of completed work (Approve or Hold). */
    public static class LeadReview {
        private String kind;
        private String action; // APPROVE, HOLD, RESET
        private String reason;

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }

        public String getAction() {
            return action;
        }

        public void setAction(String action) {
            this.action = action;
        }

        public String getReason() {
            return reason;
        }

        public void setReason(String reason) {
            this.reason = reason;
        }
    }

    /** Team Leader batch releasing all reviewed and approved tasks to testing team at once. */
    public static class BatchReleaseForTesting {
        private java.util.List<Long> taskIds;
        private String note;

        public java.util.List<Long> getTaskIds() {
            return taskIds;
        }

        public void setTaskIds(java.util.List<Long> taskIds) {
            this.taskIds = taskIds;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }
    }

    /** Team Leader actions on held tasks (Approve for testing or Reopen back to developer). */
    public static class UnholdRequest {
        private String kind;
        private String action; // APPROVE_FOR_TESTING or REOPEN_TO_DEVELOPER
        private String note;

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
        }

        public String getAction() {
            return action;
        }

        public void setAction(String action) {
            this.action = action;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }
    }
}
