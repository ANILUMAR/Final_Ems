package canteenManagment.main.UserEntity;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.util.Date;


import com.fasterxml.jackson.annotation.JsonIgnore;
@Document(collection = "AssignTask")
public class AssignTask {
    @Id
    private Long id;

    private String project;

    private String taskTitle;
    
    @JsonIgnore
    private UserEntity assignedTo;
    
  
    private Date startDate;

    private Date endDate;

    private String priority;

    // Progress of the assignment shown on /tasks and /my-tasks. Null on rows
    // created before the lifecycle existed; read as TODO.
    private WorkStatus status;

    private String module;

    private String subModule;

    private String screen;

    private String description;

    private String attachmentPath;

    private String assignedBy;

    // Rework trail: stamped the moment the item leaves DONE, so a board can say
    // why work came back without loading the history of every card.
    private Integer reopenCount;

    private String lastReopenNote;

    // ---------- the workflow trail ----------

    /**
     * The number this item is known by from the moment it is raised to the
     * moment it is closed - "TASK-00042" for a task, "BUG-00007" for a bug.
     * The kind picks the prefix and the record id (already a counter that is
     * never reused) the number, so no two items can share a code, the kind is
     * readable from the code alone, and no step of the workflow renumbers it.
     */
    private String taskCode;

    /** TASK or BUG; null on rows written before the intake existed. */
    private String kind;

    /** Where the item stands with the testing team (see ApprovalState). */
    private ApprovalState approvalState;

    /** Who raised it, and under which name, for the intake lists. */
    private Long createdById;

    private String createdBy;

    private String createdByName;

    /** When it was raised; the day the task code was stamped on it. */
    private Date createdAt;

    /** The testing team leader's decision, kept on the row for the tester to read. */
    private String reviewedBy;

    private Date reviewedAt;

    private String reviewNote;

    /** When the developer team leader handed it to a developer. */
    private Date assignedAt;

    /** Developer Team Leader draft notes / supplementary information */
    private String leadNotes;
    private String leadNotesUpdatedBy;
    private Date leadNotesUpdatedAt;

    /** Tester Team Leader approval reversal trail */
    private String reversalReason;
    private String revertedBy;
    private Date revertedAt;
    private Integer reversalCount;

    /** Bug visual reproduction flow & steps */
    private String reproductionSteps;
    private String reproductionStepsImage;
    private String reproductionFlow;

    /** Developer Team Leader release for testing */
    private Boolean releasedForTesting;
    private String releasedBy;
    private String releasedByName;
    private Date releasedAt;
    private String releaseNote;

    /** Testing Team Leader assignment to tester */
    @JsonIgnore
    private UserEntity assignedTester;
    @Transient
    private Long assignedTesterId;
    private String assignedTesterName;
    private String assignedTesterEmail;
    private Date assignedTesterAt;
    private String assignedTesterBy;
    private String testingInstructions;
    private String testingStatus;

    /** Tester verification outcome */
    private Date verifiedAt;
    private String verifiedBy;
    private String verificationNote;

    /** Team Leader review and hold status before testing release */
    private String leadReviewStatus;
    private String leadReviewedBy;
    private String leadReviewedByName;
    private Date leadReviewedAt;
    private String holdReason;
    private Date heldAt;
    private String heldBy;
    private String heldByName;

    /**
     * Read-only convenience for the clients: the numeric id of the assignee.
     * Never stored - the owner himself is in {@link #assignedTo}, which is
     * deliberately kept out of the JSON.
     */
    @Transient
    private Long assignedToId;

    /** Tasks and bugs stamped before the two were told apart share this prefix. */
    public static final String LEGACY_PREFIX = "EMS";

    /**
     * The identifier a row of this kind and id carries: "TASK-001" or
     * "BUG-001". The three-digit (or more) number starts from 001.
     */
    public static String codeFor(String kind, Long id) {
        if (id == null) {
            return "";
        }
        String prefix = "BUG".equalsIgnoreCase(kind == null ? "" : kind.trim()) ? "BUG" : "TASK";
        return String.format("%s-%03d", prefix, id);
    }

    /** True for a code from before tasks and bugs had their own prefixes. */
    public static boolean isLegacyCode(String code) {
        return code != null && code.trim().toUpperCase(java.util.Locale.ROOT).startsWith(LEGACY_PREFIX + "-");
    }

    /** Stamps the code once the record id exists; a stamped code is never rewritten. */
    public void stampCode() {
        if (taskCode == null || taskCode.trim().isEmpty()) {
            taskCode = codeFor(kind, id);
        }
    }

    /**
     * The code shown on every screen. Rows written before the intake existed
     * have no stored code, so it is derived from the kind and the id - the same
     * value the row would have been given.
     */
    public String codeOrGenerated() {
        String stored = taskCode == null ? "" : taskCode.trim();
        return stored.isEmpty() ? codeFor(kind, id) : stored;
    }

    public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
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
	
	public Date getEndDate() {
		return endDate;
	}
	public void setEndDate(Date endDate) {
		this.endDate = endDate;
	}
	public String getPriority() {
		return priority;
	}
	public void setPriority(String priority) {
		this.priority = priority;
	}
	public WorkStatus getStatus() {
		return status;
	}
	public void setStatus(WorkStatus status) {
		this.status = status;
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
	public String getAttachmentPath() {
		return attachmentPath;
	}
	public void setAttachmentPath(String attachmentPath) {
		this.attachmentPath = attachmentPath;
	}
	public Date getStartDate() {
		return startDate;
	}
	public void setStartDate(Date startDate) {
		this.startDate = startDate;
	}
	
	public UserEntity getAssignedTo() {
		return assignedTo;
	}


	public void setAssignedTo(UserEntity assignedTo) {
		this.assignedTo = assignedTo;
	}

	
    private String assignedToName; // just the username


	public String getAssignedToName() {
		return assignedToName;
	}


	public void setAssignedToName(String assignedToName) {
		this.assignedToName = assignedToName;
	}
	
	public String getAssignedBy() {
		return assignedBy;
	}
	public void setAssignedBy(String assignedBy) {
		this.assignedBy = assignedBy;
	}

	public Integer getReopenCount() {
		return reopenCount;
	}

	public void setReopenCount(Integer reopenCount) {
		this.reopenCount = reopenCount;
	}

	public String getLastReopenNote() {
		return lastReopenNote;
	}

	public void setLastReopenNote(String lastReopenNote) {
		this.lastReopenNote = lastReopenNote;
	}

	public String getTaskCode() {
		return taskCode;
	}

	public void setTaskCode(String taskCode) {
		this.taskCode = taskCode;
	}

	public String getKind() {
		return kind;
	}

	public void setKind(String kind) {
		this.kind = kind;
	}

	public ApprovalState getApprovalState() {
		return approvalState;
	}

	public void setApprovalState(ApprovalState approvalState) {
		this.approvalState = approvalState;
	}

	public Long getCreatedById() {
		return createdById;
	}

	public void setCreatedById(Long createdById) {
		this.createdById = createdById;
	}

	public String getCreatedBy() {
		return createdBy;
	}

	public void setCreatedBy(String createdBy) {
		this.createdBy = createdBy;
	}

	public String getCreatedByName() {
		return createdByName;
	}

	public void setCreatedByName(String createdByName) {
		this.createdByName = createdByName;
	}

	public Date getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Date createdAt) {
		this.createdAt = createdAt;
	}

	public String getReviewedBy() {
		return reviewedBy;
	}

	public void setReviewedBy(String reviewedBy) {
		this.reviewedBy = reviewedBy;
	}

	public Date getReviewedAt() {
		return reviewedAt;
	}

	public void setReviewedAt(Date reviewedAt) {
		this.reviewedAt = reviewedAt;
	}

	public String getReviewNote() {
		return reviewNote;
	}

	public void setReviewNote(String reviewNote) {
		this.reviewNote = reviewNote;
	}

	public Date getAssignedAt() {
		return assignedAt;
	}

	public void setAssignedAt(Date assignedAt) {
		this.assignedAt = assignedAt;
	}

	public Long getAssignedToId() {
		return assignedToId;
	}

	public void setAssignedToId(Long assignedToId) {
		this.assignedToId = assignedToId;
	}

	public String getLeadNotes() {
		return leadNotes;
	}

	public void setLeadNotes(String leadNotes) {
		this.leadNotes = leadNotes;
	}

	public String getLeadNotesUpdatedBy() {
		return leadNotesUpdatedBy;
	}

	public void setLeadNotesUpdatedBy(String leadNotesUpdatedBy) {
		this.leadNotesUpdatedBy = leadNotesUpdatedBy;
	}

	public Date getLeadNotesUpdatedAt() {
		return leadNotesUpdatedAt;
	}

	public void setLeadNotesUpdatedAt(Date leadNotesUpdatedAt) {
		this.leadNotesUpdatedAt = leadNotesUpdatedAt;
	}

	public String getReversalReason() {
		return reversalReason;
	}

	public void setReversalReason(String reversalReason) {
		this.reversalReason = reversalReason;
	}

	public String getRevertedBy() {
		return revertedBy;
	}

	public void setRevertedBy(String revertedBy) {
		this.revertedBy = revertedBy;
	}

	public Date getRevertedAt() {
		return revertedAt;
	}

	public void setRevertedAt(Date revertedAt) {
		this.revertedAt = revertedAt;
	}

	public Integer getReversalCount() {
		return reversalCount;
	}

	public void setReversalCount(Integer reversalCount) {
		this.reversalCount = reversalCount;
	}

	public String getReproductionSteps() {
		return reproductionSteps;
	}

	public void setReproductionSteps(String reproductionSteps) {
		this.reproductionSteps = reproductionSteps;
	}

	public String getReproductionStepsImage() {
		return reproductionStepsImage;
	}

	public void setReproductionStepsImage(String reproductionStepsImage) {
		this.reproductionStepsImage = reproductionStepsImage;
	}

	public String getReproductionFlow() {
		return reproductionFlow;
	}

	public void setReproductionFlow(String reproductionFlow) {
		this.reproductionFlow = reproductionFlow;
	}

	public Boolean getReleasedForTesting() {
		return releasedForTesting;
	}

	public void setReleasedForTesting(Boolean releasedForTesting) {
		this.releasedForTesting = releasedForTesting;
	}

	public String getReleasedBy() {
		return releasedBy;
	}

	public void setReleasedBy(String releasedBy) {
		this.releasedBy = releasedBy;
	}

	public String getReleasedByName() {
		return releasedByName;
	}

	public void setReleasedByName(String releasedByName) {
		this.releasedByName = releasedByName;
	}

	public Date getReleasedAt() {
		return releasedAt;
	}

	public void setReleasedAt(Date releasedAt) {
		this.releasedAt = releasedAt;
	}

	public String getReleaseNote() {
		return releaseNote;
	}

	public void setReleaseNote(String releaseNote) {
		this.releaseNote = releaseNote;
	}

	public UserEntity getAssignedTester() {
		return assignedTester;
	}

	public void setAssignedTester(UserEntity assignedTester) {
		this.assignedTester = assignedTester;
	}

	public Long getAssignedTesterId() {
		return assignedTesterId;
	}

	public void setAssignedTesterId(Long assignedTesterId) {
		this.assignedTesterId = assignedTesterId;
	}

	public String getAssignedTesterName() {
		return assignedTesterName;
	}

	public void setAssignedTesterName(String assignedTesterName) {
		this.assignedTesterName = assignedTesterName;
	}

	public String getAssignedTesterEmail() {
		return assignedTesterEmail;
	}

	public void setAssignedTesterEmail(String assignedTesterEmail) {
		this.assignedTesterEmail = assignedTesterEmail;
	}

	public Date getAssignedTesterAt() {
		return assignedTesterAt;
	}

	public void setAssignedTesterAt(Date assignedTesterAt) {
		this.assignedTesterAt = assignedTesterAt;
	}

	public String getAssignedTesterBy() {
		return assignedTesterBy;
	}

	public void setAssignedTesterBy(String assignedTesterBy) {
		this.assignedTesterBy = assignedTesterBy;
	}

	public String getTestingInstructions() {
		return testingInstructions;
	}

	public void setTestingInstructions(String testingInstructions) {
		this.testingInstructions = testingInstructions;
	}

	public String getTestingStatus() {
		return testingStatus;
	}

	public void setTestingStatus(String testingStatus) {
		this.testingStatus = testingStatus;
	}

	public Date getVerifiedAt() {
		return verifiedAt;
	}

	public void setVerifiedAt(Date verifiedAt) {
		this.verifiedAt = verifiedAt;
	}

	public String getVerifiedBy() {
		return verifiedBy;
	}

	public void setVerifiedBy(String verifiedBy) {
		this.verifiedBy = verifiedBy;
	}

	public String getVerificationNote() {
		return verificationNote;
	}

	public void setVerificationNote(String verificationNote) {
		this.verificationNote = verificationNote;
	}

	public String getLeadReviewStatus() {
		return leadReviewStatus;
	}

	public void setLeadReviewStatus(String leadReviewStatus) {
		this.leadReviewStatus = leadReviewStatus;
	}

	public String getLeadReviewedBy() {
		return leadReviewedBy;
	}

	public void setLeadReviewedBy(String leadReviewedBy) {
		this.leadReviewedBy = leadReviewedBy;
	}

	public String getLeadReviewedByName() {
		return leadReviewedByName;
	}

	public void setLeadReviewedByName(String leadReviewedByName) {
		this.leadReviewedByName = leadReviewedByName;
	}

	public Date getLeadReviewedAt() {
		return leadReviewedAt;
	}

	public void setLeadReviewedAt(Date leadReviewedAt) {
		this.leadReviewedAt = leadReviewedAt;
	}

	public String getHoldReason() {
		return holdReason;
	}

	public void setHoldReason(String holdReason) {
		this.holdReason = holdReason;
	}

	public Date getHeldAt() {
		return heldAt;
	}

	public void setHeldAt(Date heldAt) {
		this.heldAt = heldAt;
	}

	public String getHeldBy() {
		return heldBy;
	}

	public void setHeldBy(String heldBy) {
		this.heldBy = heldBy;
	}

	public String getHeldByName() {
		return heldByName;
	}

	public void setHeldByName(String heldByName) {
		this.heldByName = heldByName;
	}


	// Constructor
    public AssignTask() {}


	public AssignTask(Long id, String project, String taskTitle, UserEntity assignedTo, Date startDate, Date endDate,
			String priority, String module, String subModule, String screen, String description, String attachmentPath,
			String assignedToName) {
		super();
		this.id = id;
		this.project = project;
		this.taskTitle = taskTitle;
		this.assignedTo = assignedTo;
		this.startDate = startDate;
		this.endDate = endDate;
		this.priority = priority;
		this.module = module;
		this.subModule = subModule;
		this.screen = screen;
		this.description = description;
		this.attachmentPath = attachmentPath;
		this.assignedToName = assignedToName;
	}

    // Optional: Parameterized constructor, toString, equals, hashCode...
}