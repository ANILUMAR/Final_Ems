package canteenManagment.main.controller;

import java.io.File;
import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import canteenManagment.main.DTO.WorkflowRequests;
import canteenManagment.main.UserEntity.ApprovalState;
import canteenManagment.main.UserEntity.AssignTask;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.UserEntity.WorkStatus;
import canteenManagment.main.reference.ReferenceService;
import canteenManagment.main.security.AuthContext;
import canteenManagment.main.security.Roles;
import canteenManagment.main.service.TaskMailService;
import canteenManagment.main.service.WorkflowService;
import canteenManagment.main.service.ProjectSequenceService;
import canteenManagment.main.service.WorkItemRows;
import canteenManagment.main.service.assingTaskService;
import canteenManagment.main.userReposerity.UserRepository;
import canteenManagment.main.userReposerity.assignTaskRepository;

/**
 * The path a reported task or bug walks before it becomes a developer's work.
 *
 * <pre>
 * tester raises it        POST  /submissions              state PENDING
 * tester leader reviews   PATCH /submissions/{id}/review  APPROVED or REJECTED
 * tester corrects it      PUT   /submissions/{id}         REJECTED back to PENDING
 * developer leader reads  GET   /dev-queue                APPROVED items only
 * developer leader hands  PATCH /submissions/{id}/assign   owner stamped, state stays APPROVED
 * </pre>
 *
 * <p>The item is one document from the first step to the last, so the task code
 * stamped on it at the start is the number every screen shows - the tester's
 * list, the review queue, the assignment queue, the board and the reports. The
 * lifecycle ({@link WorkStatus}) is untouched by the approval steps: it only
 * starts moving once a developer owns the work.</p>
 *
 * <p>Every method re-checks the role itself. {@code SecurityConfig} already
 * limits who may call what; this is the second lock, because the approval step
 * is the one that decides whether work reaches the development team at all.</p>
 */
@RestController
@RequestMapping("/api/workflow")
public class WorkflowController {

    private final assignTaskRepository assignTaskRepository;
    private final canteenManagment.main.userReposerity.AssignBugRepository assignBugRepository;
    private final canteenManagment.main.userReposerity.StatusChangeRepository statusChangeRepository;
    private final UserRepository userRepository;
    private final assingTaskService assignTaskService;
    private final TaskMailService taskMailService;
    private final ReferenceService referenceService;
    private final ProjectSequenceService projectSequenceService;

    @Autowired(required = false)
    private canteenManagment.main.hierarchy.TeamHierarchyService hierarchyService;

    /** Attachments land where the create-task form puts them. */
    @Value("${file.upload-dir}")
    private String pathDirectory;

    @Autowired
    public WorkflowController(assignTaskRepository assignTaskRepository,
            canteenManagment.main.userReposerity.AssignBugRepository assignBugRepository,
            canteenManagment.main.userReposerity.StatusChangeRepository statusChangeRepository,
            UserRepository userRepository,
            assingTaskService assignTaskService, TaskMailService taskMailService,
            ReferenceService referenceService,
            ProjectSequenceService projectSequenceService) {
        this.assignTaskRepository = assignTaskRepository;
        this.assignBugRepository = assignBugRepository;
        this.statusChangeRepository = statusChangeRepository;
        this.userRepository = userRepository;
        this.assignTaskService = assignTaskService;
        this.taskMailService = taskMailService;
        this.referenceService = referenceService;
        this.projectSequenceService = projectSequenceService;
    }

    /* ------------------------------------------------------------------ */
    /* The tester's side                                                    */
    /* ------------------------------------------------------------------ */

    /**
     * A tester reports a task or a bug. It is stored as PENDING and is invisible
     * to the boards until the testing team leader approves it - so nothing a
     * tester types can land in a developer's queue on its own.
     *
     * <p>The testing leader and the CEO are the approvers of the intake, so what
     * they raise skips the queue; making them approve themselves would be
     * theatre. The developer team has no door here at all: it receives what
     * testing approved, which is why its leader cannot raise or correct.</p>
     */
    @PostMapping(value = "/submissions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> submit(@ModelAttribute WorkflowRequests.Submission submission,
            Authentication authentication) {
        if (!canRaise(authentication)) {
            return forbidden("Raise work from the task or bug screen.");
        }
        try {
            UserEntity author = caller(authentication);
            String k = kind(submission.getKind());
            boolean isBug = WorkItemRows.KIND_BUG.equalsIgnoreCase(k);
            boolean isProd = WorkItemRows.KIND_PRODUCTION_ISSUE.equalsIgnoreCase(k);
            AssignTask task = isBug ? new canteenManagment.main.UserEntity.AssignBug() : new AssignTask();
            task.setKind(k);
            task.setProject(required(submission.getProject(), "Choose the project this belongs to.")
                    .toUpperCase(Locale.ROOT));
            task.setTaskTitle(required(submission.getTaskTitle(), "Give it a short title.")
                    .toUpperCase(Locale.ROOT));
            task.setPriority(priority(submission.getPriority()));
            task.setModule(upper(submission.getModule()));
            task.setSubModule(upper(submission.getSubModule()));
            task.setScreen(upper(submission.getScreen()));
            // The report is read by people, not parsed, so it keeps its case.
            task.setDescription(trim(submission.getDescription()));
            task.setStatus(WorkStatus.TODO);
            task.setCreatedById(author.getId());
            task.setCreatedBy(author.getEmail() == null ? null : author.getEmail().toLowerCase(Locale.ROOT));
            task.setCreatedByName(author.getName());
            task.setCreatedAt(new Date());

            // If it's a bug or a production issue, capture reproduction flow and steps
            if (isBug || isProd) {
                task.setReproductionSteps(trim(submission.getReproductionSteps()));
                task.setReproductionFlow(trim(submission.getReproductionFlow()));
                if (submission.getReproductionFlowImage() != null && !submission.getReproductionFlowImage().isEmpty()) {
                    task.setReproductionStepsImage(storeAttachment(submission.getReproductionFlowImage()));
                } else if (submission.getReproductionFlowImageBase64() != null && !submission.getReproductionFlowImageBase64().trim().isEmpty()) {
                    task.setReproductionStepsImage(storeBase64Image(submission.getReproductionFlowImageBase64(), isProd ? "prod_flow" : "bug_flow"));
                }
            }

            boolean raisedByApprover = isTestingLead(authentication);
            if (isProd) {
                // Requirement 3: Automatic Assignment for Production Issues:
                // When a production issue is raised for a particular project, it should be assigned
                // only to the employees or Team Leaders who have been configured for Production Support
                // in that project's team hierarchy.
                List<UserEntity> prodUsers = hierarchyService != null ?
                        hierarchyService.getProductionSupportUsers(task.getProject()) : Collections.emptyList();
                if (!prodUsers.isEmpty()) {
                    UserEntity autoAssignee = pickBestProductionSupportAssignee(prodUsers);
                    task.setAssignedTo(autoAssignee);
                    task.setAssignedToId(autoAssignee.getId());
                    task.setAssignedToName(autoAssignee.getName());
                    task.setAssignedAt(new Date());
                    task.setAssignedBy("System (Production Support Auto-Assignment)");
                    task.setApprovalState(ApprovalState.APPROVED);
                    task.setStatus(WorkStatus.TODO);
                } else {
                    task.setApprovalState(ApprovalState.APPROVED);
                }
            } else {
                task.setApprovalState(raisedByApprover ? ApprovalState.APPROVED : ApprovalState.PENDING);
                if (raisedByApprover) {
                    task.setReviewedBy(task.getCreatedBy());
                    task.setReviewedAt(new Date());
                    task.setReviewNote(approverNote());
                }
            }

            // A plan is not known yet; the developer leader sets the real window
            // when the item is handed out. The default keeps every card dated.
            task.setStartDate(startOfToday());
            task.setEndDate(daysFromToday(7));
            task.setAttachmentPath(storeAttachment(submission.getAttachment()));

            // Generate unique, separate project-wise taskCode (TASK-001 or BUG-001)
            String generatedCode = projectSequenceService.nextCode(task.getKind(), task.getProject());
            task.setTaskCode(generatedCode);

            AssignTask saved;
            if (isBug) {
                canteenManagment.main.UserEntity.AssignBug bug = (canteenManagment.main.UserEntity.AssignBug) task;
                saved = assignBugRepository.save(bug);
            } else {
                saved = assignTaskRepository.save(task);
            }
            if (!raisedByApprover) {
                taskMailService.submissionRaised(saved);
            }
            return ResponseEntity.status(HttpStatus.CREATED).body(WorkItemRows.of(saved));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("The attachment could not be stored.");
        } catch (RuntimeException e) {
            return failure(e);
        }
    }

    /**
     * What the signed-in author has raised, newest first, in every state: still
     * waiting, approved, sent back with a comment, or already handed to a
     * developer. This is the one list where an author follows their own report.
     */
    @GetMapping("/my-submissions")
    public ResponseEntity<?> mySubmissions(Authentication authentication) {
        if (!canRaise(authentication)) {
            return forbidden("This list belongs to the people who raise work.");
        }
        String email = AuthContext.email(authentication);
        List<AssignTask> allSubmissions = new ArrayList<>();
        allSubmissions.addAll(assignTaskRepository.findAll());
        allSubmissions.addAll(assignBugRepository.findAll());
        List<AssignTask> rows = allSubmissions.stream()
                .filter((task) -> email.equalsIgnoreCase(nullSafe(task.getCreatedBy())))
                .sorted(Comparator.comparing((AssignTask t) -> t.getCreatedAt() != null ? t.getCreatedAt() : new Date(0)).reversed())
                .map(WorkItemRows::of)
                .collect(Collectors.toList());
        return ResponseEntity.ok(rows);
    }

    /**
     * A correction after a rejection. Only the author may change their own item,
     * only while it is REJECTED, and saving it puts it back in the review queue -
     * the task code never changes.
     */
    @PutMapping("/submissions/{id}")
    public ResponseEntity<?> correct(@PathVariable Long id,
            @RequestBody WorkflowRequests.Correction request, Authentication authentication) {
        if (!canRaise(authentication)) {
            return forbidden("Only the author can correct a submission.");
        }
        try {
            AssignTask task = find(id, request == null ? null : request.getKind());
            if (!AuthContext.email(authentication).equalsIgnoreCase(nullSafe(task.getCreatedBy()))) {
                throw new AccessDeniedException("You can only correct your own submissions.");
            }
            if (ApprovalState.orDefault(task.getApprovalState()) != ApprovalState.REJECTED) {
                throw new IllegalArgumentException("Only an item that was sent back can be corrected.");
            }
            if (request != null) {
                if (request.getKind() != null) {
                    task.setKind(kind(request.getKind()));
                }
                if (request.getTaskTitle() != null && !request.getTaskTitle().trim().isEmpty()) {
                    task.setTaskTitle(request.getTaskTitle().trim().toUpperCase(Locale.ROOT));
                }
                if (request.getPriority() != null && !request.getPriority().trim().isEmpty()) {
                    task.setPriority(priority(request.getPriority()));
                }
                if (request.getModule() != null) {
                    task.setModule(upper(request.getModule()));
                }
                if (request.getSubModule() != null) {
                    task.setSubModule(upper(request.getSubModule()));
                }
                if (request.getScreen() != null) {
                    task.setScreen(upper(request.getScreen()));
                }
                if (request.getDescription() != null) {
                    task.setDescription(trim(request.getDescription()));
                }
            }
            // Back into the queue, with the old decision cleared: the leader
            // reviews the corrected report, not the one they already refused.
            task.setApprovalState(ApprovalState.PENDING);
            task.setReviewedBy(null);
            task.setReviewedAt(null);
            task.setReviewNote(null);

            AssignTask saved = saveWork(task);
            taskMailService.submissionRaised(saved);
            return ResponseEntity.ok(WorkItemRows.of(saved));
        } catch (RuntimeException e) {
            return failure(e);
        }
    }

    /* ------------------------------------------------------------------ */
    /* The testing team leader's side                                       */
    /* ------------------------------------------------------------------ */

    /**
     * Everything the testing team has raised, waiting items first so the queue
     * reads top-down, then the decisions already taken with who took them.
     */
    @GetMapping("/approvals")
    public ResponseEntity<?> approvals(Authentication authentication) {
        if (!isTestingLead(authentication)) {
            return forbidden("Only the testing team leader reviews the intake.");
        }
        List<AssignTask> allSubmissions = new ArrayList<>();
        allSubmissions.addAll(assignTaskRepository.findAll());
        allSubmissions.addAll(assignBugRepository.findAll());
        List<AssignTask> rows = allSubmissions.stream()
                .filter((task) -> ApprovalState.orDefault(task.getApprovalState()) != ApprovalState.NOT_REQUIRED)
                .sorted(intakeOrder())
                .map(WorkItemRows::of)
                .collect(Collectors.toList());
        return ResponseEntity.ok(rows);
    }

    /**
     * Approve or send back. A rejection must say why - the comment is what the
     * tester corrects against, so it travels back with the item.
     */
    @PatchMapping("/submissions/{id}/review")
    public ResponseEntity<?> review(@PathVariable Long id,
            @RequestBody WorkflowRequests.Review request, Authentication authentication) {
        if (!isTestingLead(authentication)) {
            return forbidden("Only the testing team leader reviews the intake.");
        }
        try {
            AssignTask task = find(id, request == null ? null : request.getKind());
            if (ApprovalState.orDefault(task.getApprovalState()) != ApprovalState.PENDING) {
                throw new IllegalArgumentException("That item is not waiting for a decision any more.");
            }
            boolean approve = approve(request == null ? null : request.getDecision());
            String note = trim(request == null ? null : request.getNote());
            if (!approve && note.isEmpty()) {
                throw new IllegalArgumentException("Say why it is going back, so the tester can correct it.");
            }

            task.setApprovalState(approve ? ApprovalState.APPROVED : ApprovalState.REJECTED);
            task.setReviewedBy(AuthContext.email(authentication));
            task.setReviewedAt(new Date());
            task.setReviewNote(note.isEmpty() ? null : note);

            AssignTask saved = saveWork(task);
            taskMailService.submissionReviewed(saved, approve, note, AuthContext.email(authentication));
            return ResponseEntity.ok(WorkItemRows.of(saved));
        } catch (RuntimeException e) {
            return failure(e);
        }
    }

    /* ------------------------------------------------------------------ */
    /* The developer team leader's side                                     */
    /* ------------------------------------------------------------------ */

    /**
     * The only queue the development side reads: items the testing team leader
     * approved. Each row arrives with the priority, the reporter and whether it
     * already has an owner; the developers list beside it carries each person's
     * open load, which is how the leader picks who takes the next one.
     */
    @GetMapping("/dev-queue")
    public ResponseEntity<?> devQueue(@RequestParam(required = false) String project, Authentication authentication) {
        if (!isDeveloperLead(authentication)) {
            return forbidden("Only the developer team leader assigns approved work.");
        }
        List<AssignTask> all = new ArrayList<>();
        all.addAll(assignTaskRepository.findAll());
        all.addAll(assignBugRepository.findAll());
        List<AssignTask> approved = all.stream()
                .filter((task) -> ApprovalState.orDefault(task.getApprovalState()) == ApprovalState.APPROVED)
                .sorted(triageOrder())
                .map(WorkItemRows::of)
                .collect(Collectors.toList());

        long awaiting = approved.stream().filter((task) -> task.getAssignedToName() == null).count();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", approved);
        body.put("developers", developers(all, project));
        body.put("awaiting", awaiting);
        body.put("assigned", approved.size() - awaiting);
        return ResponseEntity.ok(body);
    }

    /**
     * Hands an approved item to a developer. This is the moment it becomes an
     * assignment: the owner, the priority and the planned window are stamped,
     * the developer is mailed, and the item appears on their board. The task
     * code is untouched, so every later step still points at the same number.
     */
    @PatchMapping("/submissions/{id}/assign")
    public ResponseEntity<?> assign(@PathVariable Long id,
            @RequestBody WorkflowRequests.Assignment request, Authentication authentication) {
        if (!isDeveloperLead(authentication)) {
            return forbidden("Only the developer team leader assigns approved work.");
        }
        try {
            if (request == null || request.getDeveloperId() == null) {
                throw new IllegalArgumentException("Pick the developer who takes it.");
            }
            AssignTask task = find(id, request == null ? null : request.getKind());
            if (ApprovalState.orDefault(task.getApprovalState()) != ApprovalState.APPROVED) {
                throw new IllegalArgumentException("Only an item the testing team leader approved can be assigned.");
            }
            if (task.getAssignedTo() != null) {
                throw new IllegalArgumentException(
                        "It already belongs to " + nullSafe(task.getAssignedTo().getName()) + ".");
            }
            UserEntity developer = userRepository.findById(request.getDeveloperId())
                    .orElseThrow(() -> new NoSuchElementException("That developer does not exist any more."));
            if (!Roles.FAMILY_DEVELOPER.equals(Roles.family(developer.getRole()))) {
                throw new IllegalArgumentException("Approved work is handed to a developer.");
            }
            if (Boolean.FALSE.equals(developer.getActive())) {
                throw new IllegalArgumentException(nullSafe(developer.getName()) + " is not active.");
            }

            // Verify developer is configured in the Team Hierarchy for this project
            if (hierarchyService != null && task.getProject() != null && !task.getProject().trim().isEmpty()) {
                if (!hierarchyService.isDeveloperAssignedToProject(task.getProject(), developer.getId(), developer.getEmail())) {
                    throw new IllegalArgumentException("Developer '" + developer.getName() + "' is not assigned to project '" + task.getProject() + "' in the Team Hierarchy. Only assigned project members can receive work.");
                }
                // If it's a production issue, verify developer is configured for Production Support for this project
                if (WorkItemRows.KIND_PRODUCTION_ISSUE.equalsIgnoreCase(task.getKind())) {
                    List<UserEntity> prodUsers = hierarchyService.getProductionSupportUsers(task.getProject());
                    if (!prodUsers.isEmpty()) {
                        boolean isConfigured = prodUsers.stream().anyMatch(u -> Objects.equals(u.getId(), developer.getId()));
                        if (!isConfigured) {
                            throw new IllegalArgumentException("'" + developer.getName() + "' is not configured for Production Support for project '" + task.getProject() + "'. Production issues can only be assigned to configured Production Support team members or leaders.");
                        }
                    }
                }
            }

            task.setAssignedTo(developer);
            task.setAssignedBy(AuthContext.email(authentication));
            task.setAssignedAt(new Date());
            task.setStatus(WorkStatus.TODO);
            if (request.getPriority() != null && !request.getPriority().trim().isEmpty()) {
                task.setPriority(priority(request.getPriority()));
            }
            if (request.getStartDate() != null && !request.getStartDate().trim().isEmpty()) {
                task.setStartDate(parseDate(request.getStartDate()));
            }
            if (request.getEndDate() != null && !request.getEndDate().trim().isEmpty()) {
                task.setEndDate(parseDate(request.getEndDate()));
            }

            AssignTask saved = saveWork(task);
            // The new owner hears about it through the same notice the create
            // screen sends, so there is one wording for "this is yours now".
            taskMailService.taskAssigned(saved, AuthContext.email(authentication));
            return ResponseEntity.ok(WorkItemRows.of(saved));
        } catch (RuntimeException e) {
            return failure(e);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Completion Review & Testing Handover Workflow                      */
    /* ------------------------------------------------------------------ */

    /**
     * All completed tasks and bugs (status == DONE) for the Developer Dashboard /
     * Completed Work screen. A developer reads only their own completed work;
     * the Developer Team Leader or CEO reads all completed work across the team.
     */
    @GetMapping("/completed-tasks")
    public ResponseEntity<?> completedTasks(Authentication authentication) {
        if (!AuthContext.hasRole(authentication, AuthContext.ROLE_EMPLOYEE)
                && !AuthContext.hasRole(authentication, AuthContext.ROLE_DEVELOPER_LEAD)
                && !AuthContext.hasRole(authentication, AuthContext.ROLE_TEAM_LEAD)
                && !AuthContext.isAdmin(authentication)) {
            return forbidden("Only developers and team leaders view completed developer tasks.");
        }
        String callerEmail = AuthContext.email(authentication);
        boolean isLeadOrAdmin = isDeveloperLead(authentication);

        List<AssignTask> allCompleted = new ArrayList<>();
        allCompleted.addAll(assignTaskRepository.findAll());
        allCompleted.addAll(assignBugRepository.findAll());

        List<AssignTask> rawCompleted = allCompleted.stream()
                .filter(task -> WorkStatus.orDefault(task.getStatus()) == WorkStatus.DONE
                        || Boolean.TRUE.equals(task.getReleasedForTesting())
                        || "APPROVED".equalsIgnoreCase(task.getLeadReviewStatus())
                        || "ON_HOLD".equalsIgnoreCase(task.getLeadReviewStatus()))
                .filter(task -> {
                    if (isLeadOrAdmin) {
                        return true;
                    }
                    return task.getAssignedTo() != null && callerEmail.equalsIgnoreCase(task.getAssignedTo().getEmail());
                })
                .collect(Collectors.toList());

        long onHoldCount = rawCompleted.stream().filter(t -> "ON_HOLD".equalsIgnoreCase(t.getLeadReviewStatus())).count();

        // Tasks on hold are displayed on the dedicated "On Hold Tasks" screen, so exclude from active completed list
        List<AssignTask> completedList = rawCompleted.stream()
                .filter(t -> !"ON_HOLD".equalsIgnoreCase(t.getLeadReviewStatus()))
                .sorted(Comparator.comparing((AssignTask t) -> t.getEndDate() != null ? t.getEndDate() : (t.getCreatedAt() != null ? t.getCreatedAt() : new Date(0))).reversed())
                .map(WorkItemRows::of)
                .collect(Collectors.toList());

        long awaitingRelease = completedList.stream().filter(t -> !Boolean.TRUE.equals(t.getReleasedForTesting())).count();
        long awaitingReview = completedList.stream().filter(t -> !Boolean.TRUE.equals(t.getReleasedForTesting()) && !"APPROVED".equalsIgnoreCase(t.getLeadReviewStatus())).count();
        long approvedForRelease = completedList.stream().filter(t -> !Boolean.TRUE.equals(t.getReleasedForTesting()) && "APPROVED".equalsIgnoreCase(t.getLeadReviewStatus())).count();
        long releasedForTesting = completedList.stream().filter(t -> Boolean.TRUE.equals(t.getReleasedForTesting())).count();
        long inTesting = completedList.stream().filter(t -> "IN_TESTING".equalsIgnoreCase(t.getTestingStatus())).count();
        long verified = completedList.stream().filter(t -> "VERIFIED".equalsIgnoreCase(t.getTestingStatus())).count();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", completedList);
        response.put("totalCompleted", completedList.size());
        response.put("awaitingRelease", awaitingRelease);
        response.put("awaitingReview", awaitingReview);
        response.put("approvedForRelease", approvedForRelease);
        response.put("onHoldCount", onHoldCount);
        response.put("releasedForTesting", releasedForTesting);
        response.put("inTesting", inTesting);
        response.put("verified", verified);
        return ResponseEntity.ok(response);
    }

    /**
     * Team Leader reviews a completed task/bug before testing: Approve or Put on Hold.
     */
    @PatchMapping("/tasks/{id}/lead-review")
    public ResponseEntity<?> leadReview(@PathVariable Long id,
            @RequestBody WorkflowRequests.LeadReview request,
            Authentication authentication) {
        if (!isDeveloperLead(authentication)) {
            return forbidden("Only the Developer Team Leader or Administrator can review completed work.");
        }
        try {
            String kind = request != null ? request.getKind() : null;
            AssignTask task = find(id, kind);
            if (WorkStatus.orDefault(task.getStatus()) != WorkStatus.DONE) {
                throw new IllegalArgumentException("Only work marked as Done can be reviewed for testing.");
            }
            UserEntity leader = caller(authentication);
            String action = request != null && request.getAction() != null ? request.getAction().trim().toUpperCase(Locale.ROOT) : "";

            if ("APPROVE".equals(action)) {
                task.setLeadReviewStatus("APPROVED");
                task.setLeadReviewedBy(leader.getEmail());
                task.setLeadReviewedByName(leader.getName());
                task.setLeadReviewedAt(new Date());
                task.setHoldReason(null);
            } else if ("HOLD".equals(action)) {
                String reason = request != null && request.getReason() != null ? request.getReason().trim() : "";
                if (reason.isEmpty()) {
                    throw new IllegalArgumentException("Please provide a reason for placing this task on hold.");
                }
                task.setLeadReviewStatus("ON_HOLD");
                task.setHoldReason(reason);
                task.setHeldBy(leader.getEmail());
                task.setHeldByName(leader.getName());
                task.setHeldAt(new Date());
            } else if ("RESET".equals(action)) {
                task.setLeadReviewStatus("PENDING_REVIEW");
                task.setLeadReviewedBy(null);
                task.setLeadReviewedByName(null);
                task.setLeadReviewedAt(null);
                task.setHoldReason(null);
            } else {
                throw new IllegalArgumentException("Invalid review action. Must be APPROVE, HOLD, or RESET.");
            }

            AssignTask saved = saveWork(task);
            return ResponseEntity.ok(WorkItemRows.of(saved));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Task not found.");
        } catch (RuntimeException e) {
            return failure(e);
        }
    }

    /**
     * Team Leader clicks "Release for Testing" at the top of Developer Completed screen:
     * Releases ALL reviewed & approved tasks to Testing Team at once.
     */
    @PostMapping("/tasks/batch-release-for-testing")
    public ResponseEntity<?> batchReleaseForTesting(
            @RequestBody(required = false) WorkflowRequests.BatchReleaseForTesting request,
            Authentication authentication) {
        if (!isDeveloperLead(authentication)) {
            return forbidden("Only the Developer Team Leader or Administrator can release completed tasks for testing.");
        }
        try {
            UserEntity leader = caller(authentication);
            String note = request != null && request.getNote() != null ? request.getNote().trim() : "";
            if (note.isEmpty()) {
                note = "Batch release approved by Team Leader for QA verification.";
            }

            List<Long> explicitIds = request != null ? request.getTaskIds() : null;

            List<AssignTask> allItems = new ArrayList<>();
            allItems.addAll(assignTaskRepository.findAll());
            allItems.addAll(assignBugRepository.findAll());

            List<AssignTask> toRelease = allItems.stream()
                    .filter(t -> WorkStatus.orDefault(t.getStatus()) == WorkStatus.DONE)
                    .filter(t -> !Boolean.TRUE.equals(t.getReleasedForTesting()))
                    .filter(t -> !"ON_HOLD".equalsIgnoreCase(t.getLeadReviewStatus()))
                    .filter(t -> {
                        if (explicitIds != null && !explicitIds.isEmpty()) {
                            return explicitIds.contains(t.getId());
                        }
                        // Release all reviewed and approved tasks
                        return "APPROVED".equalsIgnoreCase(t.getLeadReviewStatus());
                    })
                    .collect(Collectors.toList());

            if (toRelease.isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("No reviewed and approved tasks found ready to release for testing.");
            }

            List<String> releasedCodes = new ArrayList<>();
            Date now = new Date();

            for (AssignTask task : toRelease) {
                task.setReleasedForTesting(true);
                task.setReleasedBy(leader.getEmail());
                task.setReleasedByName(leader.getName());
                task.setReleasedAt(now);
                task.setReleaseNote(note);
                if (task.getTestingStatus() == null || "FAILED".equalsIgnoreCase(task.getTestingStatus())) {
                    task.setTestingStatus("AWAITING_TESTER");
                }
                AssignTask saved = saveWork(task);
                releasedCodes.add(saved.codeOrGenerated());

                canteenManagment.main.UserEntity.StatusChange history = new canteenManagment.main.UserEntity.StatusChange();
                history.setEntityType(WorkflowService.ASSIGNMENT);
                history.setEntityId(saved.getId());
                history.setEntityTitle(saved.getTaskTitle());
                history.setFromStatus(WorkStatus.DONE);
                history.setToStatus(WorkStatus.DONE);
                history.setActorEmail(leader.getEmail());
                history.setActorName(leader.getName());
                history.setNote("Batch release for testing: " + note);
                history.setChangedAt(now);
                statusChangeRepository.save(history);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("releasedCount", toRelease.size());
            result.put("releasedCodes", releasedCodes);
            result.put("message", "Successfully moved " + toRelease.size() + " reviewed and approved task(s) to Testing Team at once.");
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return failure(e);
        }
    }

    /**
     * Dedicated On-Hold Tasks screen: retrieves all tasks and bugs placed on hold.
     */
    @GetMapping("/on-hold-tasks")
    public ResponseEntity<?> onHoldTasks(Authentication authentication) {
        if (!AuthContext.hasRole(authentication, AuthContext.ROLE_EMPLOYEE)
                && !AuthContext.hasRole(authentication, AuthContext.ROLE_DEVELOPER_LEAD)
                && !AuthContext.hasRole(authentication, AuthContext.ROLE_TEAM_LEAD)
                && !AuthContext.isAdmin(authentication)) {
            return forbidden("Access denied to on-hold tasks.");
        }
        String callerEmail = AuthContext.email(authentication);
        boolean isLeadOrAdmin = isDeveloperLead(authentication);

        List<AssignTask> allItems = new ArrayList<>();
        allItems.addAll(assignTaskRepository.findAll());
        allItems.addAll(assignBugRepository.findAll());

        List<AssignTask> onHoldList = allItems.stream()
                .filter(t -> "ON_HOLD".equalsIgnoreCase(t.getLeadReviewStatus()))
                .filter(t -> {
                    if (isLeadOrAdmin) {
                        return true;
                    }
                    return t.getAssignedTo() != null && callerEmail.equalsIgnoreCase(t.getAssignedTo().getEmail());
                })
                .sorted(Comparator.comparing((AssignTask t) -> t.getHeldAt() != null ? t.getHeldAt() : new Date(0)).reversed())
                .map(WorkItemRows::of)
                .collect(Collectors.toList());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", onHoldList);
        response.put("totalOnHold", onHoldList.size());
        return ResponseEntity.ok(response);
    }

    /**
     * Team Leader actions on held tasks: Approve for testing or Reopen back to developer.
     */
    @PatchMapping("/tasks/{id}/unhold")
    public ResponseEntity<?> unhold(@PathVariable Long id,
            @RequestBody WorkflowRequests.UnholdRequest request,
            Authentication authentication) {
        if (!isDeveloperLead(authentication)) {
            return forbidden("Only the Developer Team Leader or Administrator can update held tasks.");
        }
        try {
            String kind = request != null ? request.getKind() : null;
            AssignTask task = find(id, kind);
            if (!"ON_HOLD".equalsIgnoreCase(task.getLeadReviewStatus())) {
                throw new IllegalArgumentException("This task is not currently on hold.");
            }
            UserEntity leader = caller(authentication);
            String action = request != null && request.getAction() != null ? request.getAction().trim().toUpperCase(Locale.ROOT) : "";
            String note = request != null && request.getNote() != null ? request.getNote().trim() : "";

            if ("APPROVE_FOR_TESTING".equals(action)) {
                task.setLeadReviewStatus("APPROVED");
                task.setLeadReviewedBy(leader.getEmail());
                task.setLeadReviewedByName(leader.getName());
                task.setLeadReviewedAt(new Date());
                task.setHoldReason(null);
            } else if ("REOPEN_TO_DEVELOPER".equals(action)) {
                if (note.isEmpty()) {
                    throw new IllegalArgumentException("Please provide rework instructions for the developer.");
                }
                task.setStatus(WorkStatus.IN_PROGRESS);
                task.setLeadReviewStatus(null);
                task.setHoldReason(null);
                task.setReleasedForTesting(false);
                int reopens = task.getReopenCount() == null ? 0 : task.getReopenCount();
                task.setReopenCount(reopens + 1);
                task.setLastReopenNote("Reopened from Hold by " + leader.getName() + ": " + note);

                canteenManagment.main.UserEntity.StatusChange history = new canteenManagment.main.UserEntity.StatusChange();
                history.setEntityType(WorkflowService.ASSIGNMENT);
                history.setEntityId(task.getId());
                history.setEntityTitle(task.getTaskTitle());
                history.setFromStatus(WorkStatus.DONE);
                history.setToStatus(WorkStatus.IN_PROGRESS);
                history.setActorEmail(leader.getEmail());
                history.setActorName(leader.getName());
                history.setNote("Sent back to developer from Hold: " + note);
                history.setChangedAt(new Date());
                statusChangeRepository.save(history);
            } else {
                throw new IllegalArgumentException("Invalid action: must be APPROVE_FOR_TESTING or REOPEN_TO_DEVELOPER.");
            }

            AssignTask saved = saveWork(task);
            return ResponseEntity.ok(WorkItemRows.of(saved));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Task not found.");
        } catch (RuntimeException e) {
            return failure(e);
        }
    }

    /**
     * Developer Team Leader reviews a completed task/bug and releases it for testing.
     * The item will then appear on the Testing Team Leader Dashboard.
     */
    @PatchMapping("/tasks/{id}/release-for-testing")
    public ResponseEntity<?> releaseForTesting(@PathVariable Long id,
            @RequestBody(required = false) WorkflowRequests.ReleaseForTesting request,
            Authentication authentication) {
        if (!isDeveloperLead(authentication)) {
            return forbidden("Only the Developer Team Leader or Administrator can release completed tasks for testing.");
        }
        try {
            String kind = request != null ? request.getKind() : null;
            AssignTask task = find(id, kind);
            if (WorkStatus.orDefault(task.getStatus()) != WorkStatus.DONE) {
                throw new IllegalArgumentException("Only work marked as Done can be released for testing.");
            }
            UserEntity leader = caller(authentication);
            String note = request != null && request.getNote() != null ? request.getNote().trim() : "";

            task.setReleasedForTesting(true);
            task.setReleasedBy(leader.getEmail());
            task.setReleasedByName(leader.getName());
            task.setReleasedAt(new Date());
            task.setReleaseNote(note.isEmpty() ? "Released for QA verification." : note);
            if (task.getTestingStatus() == null || "FAILED".equalsIgnoreCase(task.getTestingStatus())) {
                task.setTestingStatus("AWAITING_TESTER");
            }

            AssignTask saved = saveWork(task);

            canteenManagment.main.UserEntity.StatusChange history = new canteenManagment.main.UserEntity.StatusChange();
            history.setEntityType(WorkflowService.ASSIGNMENT);
            history.setEntityId(id);
            history.setEntityTitle(saved.getTaskTitle());
            history.setFromStatus(WorkStatus.DONE);
            history.setToStatus(WorkStatus.DONE);
            history.setActorEmail(leader.getEmail());
            history.setActorName(leader.getName());
            history.setNote("Released for testing: " + (note.isEmpty() ? "No notes" : note));
            history.setChangedAt(new Date());
            statusChangeRepository.save(history);

            return ResponseEntity.ok(WorkItemRows.of(saved));
        } catch (RuntimeException e) {
            return failure(e);
        }
    }

    /**
     * Testing Team Leader Dashboard queue: All tasks and bugs that have been released
     * by the development team for testing. Includes the live workload of all testers.
     */
    @GetMapping("/testing-queue")
    public ResponseEntity<?> testingQueue(Authentication authentication) {
        if (!isTestingLead(authentication)) {
            return forbidden("Only the Testing Team Leader or Administrator can access the Testing Team Leader Dashboard.");
        }
        List<AssignTask> all = new ArrayList<>();
        all.addAll(assignTaskRepository.findAll());
        all.addAll(assignBugRepository.findAll());

        List<AssignTask> releasedItems = all.stream()
                .filter(t -> Boolean.TRUE.equals(t.getReleasedForTesting()))
                .sorted(Comparator.comparing((AssignTask t) -> t.getAssignedTesterName() == null ? 0 : 1)
                        .thenComparing(Comparator.comparing((AssignTask t) -> t.getReleasedAt() != null ? t.getReleasedAt() : new Date(0)).reversed()))
                .map(WorkItemRows::of)
                .collect(Collectors.toList());

        List<Map<String, Object>> testers = new ArrayList<>();
        for (UserEntity user : userRepository.findAll()) {
            if (!Roles.FAMILY_TESTER.equals(Roles.family(user.getRole()))) {
                continue;
            }
            java.util.Set<String> assignedProjects = hierarchyService != null ?
                    hierarchyService.getAssignedProjectNamesForUser(user.getEmail()) :
                    java.util.Collections.emptySet();

            long openTesting = all.stream()
                    .filter(t -> Boolean.TRUE.equals(t.getReleasedForTesting())
                            && t.getAssignedTester() != null
                            && Objects.equals(t.getAssignedTester().getId(), user.getId())
                            && !"VERIFIED".equalsIgnoreCase(t.getTestingStatus()))
                    .count();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", user.getId());
            row.put("name", user.getName());
            row.put("email", user.getEmail());
            row.put("role", user.getRole());
            row.put("active", !Boolean.FALSE.equals(user.getActive()));
            row.put("openTestingTasks", openTesting);
            row.put("assignedProjects", assignedProjects);
            testers.add(row);
        }
        testers.sort((a, b) -> String.valueOf(a.get("name")).compareToIgnoreCase(String.valueOf(b.get("name"))));

        long awaiting = releasedItems.stream().filter(t -> t.getAssignedTesterName() == null).count();
        long inTesting = releasedItems.stream().filter(t -> t.getAssignedTesterName() != null && !"VERIFIED".equalsIgnoreCase(t.getTestingStatus())).count();
        long verified = releasedItems.stream().filter(t -> "VERIFIED".equalsIgnoreCase(t.getTestingStatus())).count();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", releasedItems);
        body.put("testers", testers);
        body.put("awaiting", awaiting);
        body.put("assigned", inTesting);
        body.put("verified", verified);
        body.put("totalReleased", releasedItems.size());
        return ResponseEntity.ok(body);
    }

    /**
     * Testing Team Leader assigns a released task or bug to a tester for verification.
     */
    @PatchMapping("/tasks/{id}/assign-tester")
    public ResponseEntity<?> assignTester(@PathVariable Long id,
            @RequestBody WorkflowRequests.AssignTester request, Authentication authentication) {
        if (!isTestingLead(authentication)) {
            return forbidden("Only the Testing Team Leader or Administrator can assign testing tasks.");
        }
        try {
            if (request == null || request.getTesterId() == null) {
                throw new IllegalArgumentException("Pick the testing team member to assign.");
            }
            String kind = request.getKind();
            AssignTask task = find(id, kind);
            if (!Boolean.TRUE.equals(task.getReleasedForTesting())) {
                throw new IllegalArgumentException("This item has not been released for testing by the development team yet.");
            }
            UserEntity tester = userRepository.findById(request.getTesterId())
                    .orElseThrow(() -> new NoSuchElementException("That tester does not exist."));
            if (!Roles.FAMILY_TESTER.equals(Roles.family(tester.getRole()))) {
                throw new IllegalArgumentException("Verification tasks must be assigned to a member of the testing team.");
            }
            if (Boolean.FALSE.equals(tester.getActive())) {
                throw new IllegalArgumentException(tester.getName() + " is currently deactivated.");
            }

            // Verify tester is configured in the Team Hierarchy for this project
            if (hierarchyService != null && task.getProject() != null && !task.getProject().trim().isEmpty()) {
                if (!hierarchyService.isTesterAssignedToProject(task.getProject(), tester.getId(), tester.getEmail())) {
                    throw new IllegalArgumentException("Tester '" + tester.getName() + "' is not assigned to project '" + task.getProject() + "' in the Team Hierarchy. Only testers configured for this project can be assigned verification work.");
                }
            }

            UserEntity leader = caller(authentication);
            WorkStatus previousStatus = WorkStatus.orDefault(task.getStatus());
            task.setAssignedTester(tester);
            task.setAssignedTesterId(tester.getId());
            task.setAssignedTesterName(tester.getName());
            task.setAssignedTesterEmail(tester.getEmail());
            task.setAssignedTesterAt(new Date());
            task.setAssignedTesterBy(leader.getEmail());
            task.setTestingInstructions(trim(request.getNote()));
            task.setTestingStatus("IN_TESTING");
            // Requirement: After Testing Lead assigns task/bug to tester, it should NOT remain Done immediately.
            // Status remains Assigned until tester completes the task and marks it as Done.
            task.setStatus(WorkStatus.ASSIGNED);
            if (request.getPriority() != null && !request.getPriority().trim().isEmpty()) {
                task.setPriority(priority(request.getPriority()));
            }

            AssignTask saved = saveWork(task);

            canteenManagment.main.UserEntity.StatusChange history = new canteenManagment.main.UserEntity.StatusChange();
            history.setEntityType(WorkflowService.ASSIGNMENT);
            history.setEntityId(id);
            history.setEntityTitle(saved.getTaskTitle());
            history.setFromStatus(previousStatus);
            history.setToStatus(WorkStatus.ASSIGNED);
            history.setActorEmail(leader.getEmail());
            history.setActorName(leader.getName());
            history.setNote("Assigned to tester " + tester.getName() + " for QA verification: " + (request.getNote() != null ? request.getNote() : ""));
            history.setChangedAt(new Date());
            statusChangeRepository.save(history);

            return ResponseEntity.ok(WorkItemRows.of(saved));
        } catch (RuntimeException e) {
            return failure(e);
        }
    }





    /**
     * Tester or Testing Team Leader marks verification outcome:
     * PASSED: Sets testingStatus = VERIFIED.
     * FAILED: Reopens task back to IN_PROGRESS, sets lastReopenNote, releasedForTesting = false.
     */
    @PatchMapping("/tasks/{id}/verify-test")
    public ResponseEntity<?> verifyTest(@PathVariable Long id,
            @RequestBody WorkflowRequests.VerifyTest request, Authentication authentication) {
        if (!isTesterTeam(authentication) && !AuthContext.isAdmin(authentication)) {
            return forbidden("Only testing team members or administrators can verify test outcomes.");
        }
        try {
            if (request == null || request.getResult() == null || request.getResult().trim().isEmpty()) {
                throw new IllegalArgumentException("Provide test result: PASSED or FAILED.");
            }
            String result = request.getResult().trim().toUpperCase(Locale.ROOT);
            String note = trim(request.getNote());
            if (!"PASSED".equals(result) && !"FAILED".equals(result)) {
                throw new IllegalArgumentException("Result must be PASSED or FAILED.");
            }
            if ("FAILED".equals(result) && note.isEmpty()) {
                throw new IllegalArgumentException("Please provide a reason/reproduction details for the test failure.");
            }

            String kind = request.getKind();
            AssignTask task = find(id, kind);
            UserEntity actor = caller(authentication);

            task.setVerifiedAt(new Date());
            task.setVerifiedBy(actor.getEmail());
            task.setVerificationNote(note.isEmpty() ? null : note);

            WorkStatus previousStatus = WorkStatus.orDefault(task.getStatus());
            if ("PASSED".equals(result)) {
                task.setTestingStatus("VERIFIED");
                // Tester completed task: status is now updated to Done
                task.setStatus(WorkStatus.DONE);
            } else {
                task.setTestingStatus("FAILED");
                task.setReleasedForTesting(false);
                task.setStatus(WorkStatus.IN_PROGRESS);
                task.setReopenCount((task.getReopenCount() == null ? 0 : task.getReopenCount()) + 1);
                task.setLastReopenNote("QA Verification Failed: " + note);
            }

            AssignTask saved = saveWork(task);

            canteenManagment.main.UserEntity.StatusChange history = new canteenManagment.main.UserEntity.StatusChange();
            history.setEntityType(WorkflowService.ASSIGNMENT);
            history.setEntityId(id);
            history.setEntityTitle(saved.getTaskTitle());
            history.setFromStatus(previousStatus);
            history.setToStatus(saved.getStatus());
            history.setActorEmail(actor.getEmail());
            history.setActorName(actor.getName());
            history.setNote("QA Verification " + result + ": " + (note.isEmpty() ? "No notes" : note));
            history.setChangedAt(new Date());
            statusChangeRepository.save(history);

            if ("PASSED".equals(result)) {
                taskMailService.notifyTestingTaskCompleted(saved, actor.getEmail());
            }

            return ResponseEntity.ok(WorkItemRows.of(saved));
        } catch (RuntimeException e) {
            return failure(e);
        }
    }

    /**
     * Dedicated screen for both Testing Team Leader and Developer Team Leader to review
     * work after the tester has completed it and marked it as Done (verified).
     */
    @GetMapping("/tested-completed")
    public ResponseEntity<?> testedCompletedTasks(Authentication authentication) {
        if (!isTestingLead(authentication) && !isDeveloperLead(authentication)) {
            return forbidden("Only the Testing Team Leader, Developer Team Leader, or Administrator can review tested completed tasks.");
        }

        List<AssignTask> allItems = new ArrayList<>();
        allItems.addAll(assignTaskRepository.findAll());
        allItems.addAll(assignBugRepository.findAll());

        List<AssignTask> completedList = allItems.stream()
                .filter(t -> "VERIFIED".equalsIgnoreCase(t.getTestingStatus())
                        || (WorkStatus.orDefault(t.getStatus()) == WorkStatus.DONE && t.getAssignedTesterName() != null))
                .sorted(Comparator.comparing((AssignTask t) -> t.getVerifiedAt() != null ? t.getVerifiedAt() : (t.getEndDate() != null ? t.getEndDate() : new Date(0))).reversed())
                .map(WorkItemRows::of)
                .collect(Collectors.toList());

        long bugsCount = completedList.stream().filter(t -> "BUG".equalsIgnoreCase(t.getKind())).count();
        long tasksCount = completedList.stream().filter(t -> !"BUG".equalsIgnoreCase(t.getKind())).count();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", completedList);
        response.put("total", completedList.size());
        response.put("bugsCount", bugsCount);
        response.put("tasksCount", tasksCount);
        return ResponseEntity.ok(response);
    }

    /**
     * Dedicated Completed Tasks list for each tester displaying only the tasks and bugs
     * they have personally completed (tested, verified and marked as Done).
     */
    @GetMapping("/tester-completed")
    public ResponseEntity<?> testerCompletedTasks(@RequestParam(required = false) String email,
            Authentication authentication) {
        if (!isTesterTeam(authentication) && !isTestingLead(authentication) && !AuthContext.isAdmin(authentication)) {
            return forbidden("Only testers or leaders can access tester completed tasks.");
        }

        String callerEmail = AuthContext.email(authentication);
        String targetEmail = (email != null && !email.trim().isEmpty() && (isTestingLead(authentication) || AuthContext.isAdmin(authentication)))
                ? email.trim() : callerEmail;

        UserEntity targetUser = userRepository.findByEmailIgnoreCase(targetEmail)
                .orElseGet(() -> userRepository.findByEmail(targetEmail).orElse(null));
        Long targetId = targetUser != null ? targetUser.getId() : null;

        List<AssignTask> allItems = new ArrayList<>();
        allItems.addAll(assignTaskRepository.findAll());
        allItems.addAll(assignBugRepository.findAll());

        List<AssignTask> personalCompleted = allItems.stream()
                .filter(t -> ("VERIFIED".equalsIgnoreCase(t.getTestingStatus())
                        || (WorkStatus.orDefault(t.getStatus()) == WorkStatus.DONE && t.getAssignedTesterName() != null)))
                .filter(t -> {
                    boolean matchId = targetId != null && ((t.getAssignedTesterId() != null && Objects.equals(t.getAssignedTesterId(), targetId))
                            || (t.getAssignedTester() != null && Objects.equals(t.getAssignedTester().getId(), targetId)));
                    boolean matchEmail = targetEmail != null && ((t.getAssignedTesterEmail() != null && targetEmail.equalsIgnoreCase(t.getAssignedTesterEmail().trim()))
                            || (t.getAssignedTester() != null && t.getAssignedTester().getEmail() != null && targetEmail.equalsIgnoreCase(t.getAssignedTester().getEmail().trim())));
                    return matchId || matchEmail;
                })
                .sorted(Comparator.comparing((AssignTask t) -> t.getVerifiedAt() != null ? t.getVerifiedAt() : (t.getEndDate() != null ? t.getEndDate() : new Date(0))).reversed())
                .map(WorkItemRows::of)
                .collect(Collectors.toList());

        long bugsCount = personalCompleted.stream().filter(t -> "BUG".equalsIgnoreCase(t.getKind())).count();
        long tasksCount = personalCompleted.stream().filter(t -> !"BUG".equalsIgnoreCase(t.getKind())).count();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", personalCompleted);
        response.put("total", personalCompleted.size());
        response.put("bugsCount", bugsCount);
        response.put("tasksCount", tasksCount);
        response.put("testerEmail", targetEmail);
        response.put("testerName", targetUser != null ? targetUser.getName() : targetEmail);
        return ResponseEntity.ok(response);
    }

    /* ------------------------------------------------------------------ */
    /* Helpers                                                             */
    /* ------------------------------------------------------------------ */

    /** A plain tester or the testing team leader - both carry ROLE_TESTER. */
    private boolean isTesterTeam(Authentication authentication) {
        return AuthContext.hasRole(authentication, AuthContext.ROLE_TESTER);
    }

    /** The person who approves; the CEO may step in as everywhere else. */
    private boolean isTestingLead(Authentication authentication) {
        return AuthContext.hasRole(authentication, AuthContext.ROLE_TESTER_LEAD)
                || AuthContext.hasRole(authentication, AuthContext.ROLE_TEAM_LEAD)
                || AuthContext.isAdmin(authentication);
    }

    /** The person who hands approved work to the developers. */
    private boolean isDeveloperLead(Authentication authentication) {
        return AuthContext.hasRole(authentication, AuthContext.ROLE_DEVELOPER_LEAD)
                || AuthContext.hasRole(authentication, AuthContext.ROLE_TEAM_LEAD)
                || AuthContext.isAdmin(authentication);
    }

    /**
     * Who may put work into the queue: the testing team reports what it finds.
     * The CEO reviews the intake and hands it out but raises nothing, and the
     * development team takes what the intake approved - so neither of them
     * opens the raise screen or the list of submissions that feeds it.
     */
    private boolean canRaise(Authentication authentication) {
        return isTesterTeam(authentication);
    }

    /** Why an item that skipped the review queue is already approved. */
    private String approverNote() {
        return "Raised by the testing team leader.";
    }

    private UserEntity caller(Authentication authentication) {
        return userRepository.findByEmailIgnoreCase(AuthContext.email(authentication))
                .orElseThrow(() -> new AccessDeniedException("Your account could not be found."));
    }

    private AssignTask find(Long id) {
        return find(id, null);
    }

    private AssignTask find(Long id, String kind) {
        if ("BUG".equalsIgnoreCase(kind)) {
            AssignTask b = assignBugRepository.findById(id).orElse(null);
            if (b != null) return b;
        } else if ("TASK".equalsIgnoreCase(kind) || "PRODUCTION_ISSUE".equalsIgnoreCase(kind)) {
            AssignTask t = assignTaskRepository.findById(id).orElse(null);
            if (t != null) return t;
        }
        AssignTask b = assignBugRepository.findById(id).orElse(null);
        if (b != null) return b;
        return assignTaskRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("That item does not exist any more."));
    }

    private AssignTask saveWork(AssignTask item) {
        if (item instanceof canteenManagment.main.UserEntity.AssignBug || "BUG".equalsIgnoreCase(item.getKind())) {
            canteenManagment.main.UserEntity.AssignBug bug = item instanceof canteenManagment.main.UserEntity.AssignBug
                    ? (canteenManagment.main.UserEntity.AssignBug) item
                    : canteenManagment.main.UserEntity.AssignBug.fromTask(item);
            return assignBugRepository.save(bug);
        }
        return assignTaskRepository.save(item);
    }

    /** Waiting items first, then the most recently decided. */
    private Comparator<AssignTask> intakeOrder() {
        return Comparator
                .comparing((AssignTask task) -> ApprovalState.orDefault(task.getApprovalState()) == ApprovalState.PENDING ? 0 : 1)
                .thenComparing((AssignTask task) -> task.getReviewedAt() == null ? new Date(0) : task.getReviewedAt(),
                        Comparator.reverseOrder())
                .thenComparing(Comparator.comparing(AssignTask::getId).reversed());
    }

    /**
     * Unassigned first, then by how urgent the priority is in the app_lookup
     * list (High before Medium before Low), then oldest report first.
     */
    private Comparator<AssignTask> triageOrder() {
        List<String> priorities = referenceService.codes(ReferenceService.PRIORITY);
        return Comparator
                .comparing((AssignTask task) -> task.getAssignedTo() == null ? 0 : 1)
                .thenComparingInt((AssignTask task) -> {
                    int index = priorities.indexOf(upper(task.getPriority()));
                    return index < 0 ? priorities.size() : index;
                })
                .thenComparing(AssignTask::getId);
    }

    /** Each developer and the work already in their hands, with assigned projects from team hierarchy. */
    private List<Map<String, Object>> developers(List<AssignTask> all, String project) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserEntity user : userRepository.findAll()) {
            if (!Roles.FAMILY_DEVELOPER.equals(Roles.family(user.getRole()))) {
                continue;
            }
            java.util.Set<String> assignedProjects = hierarchyService != null ?
                    hierarchyService.getAssignedProjectNamesForUser(user.getEmail()) :
                    java.util.Collections.emptySet();

            if (project != null && !project.trim().isEmpty() && hierarchyService != null) {
                boolean assignedToThisProject = assignedProjects.stream()
                        .anyMatch(p -> canteenManagment.main.hierarchy.TeamHierarchyService.projectMatches(p, project));
                if (!assignedToThisProject) {
                    continue;
                }
            }

            long open = all.stream()
                    .filter((task) -> task.getAssignedTo() != null
                            && Objects.equals(task.getAssignedTo().getId(), user.getId())
                            && WorkStatus.orDefault(task.getStatus()) != WorkStatus.DONE)
                    .count();
            boolean isProd = false;
            if (hierarchyService != null) {
                if (project != null && !project.trim().isEmpty()) {
                    isProd = hierarchyService.isUserConfiguredForProductionSupport(user.getEmail(), project);
                } else {
                    isProd = hierarchyService.isUserConfiguredForProductionSupportAnyProject(user.getEmail());
                }
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", user.getId());
            row.put("name", user.getName());
            row.put("email", user.getEmail());
            row.put("role", user.getRole());
            row.put("active", !Boolean.FALSE.equals(user.getActive()));
            row.put("openTasks", open);
            row.put("assignedProjects", assignedProjects);
            row.put("productionSupport", isProd);
            rows.add(row);
        }
        rows.sort((left, right) -> String.valueOf(left.get("name"))
                .compareToIgnoreCase(String.valueOf(right.get("name"))));
        return rows;
    }

    private UserEntity pickBestProductionSupportAssignee(List<UserEntity> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }
        if (candidates.size() == 1) {
            return candidates.get(0);
        }
        List<AssignTask> allTasks = new ArrayList<>();
        allTasks.addAll(assignTaskRepository.findAll());
        allTasks.addAll(assignBugRepository.findAll());

        UserEntity best = candidates.get(0);
        long minLoad = Long.MAX_VALUE;
        for (UserEntity u : candidates) {
            long open = allTasks.stream()
                    .filter(t -> t.getAssignedTo() != null && Objects.equals(t.getAssignedTo().getId(), u.getId())
                            && WorkStatus.orDefault(t.getStatus()) != WorkStatus.DONE)
                    .count();
            if (open < minLoad) {
                minLoad = open;
                best = u;
            }
        }
        return best;
    }

    /** TASK, BUG, or PRODUCTION_ISSUE; anything else is a correctable input error. */
    private String kind(String value) {
        String trimmed = upper(value);
        if (WorkItemRows.KIND_BUG.equals(trimmed)) {
            return WorkItemRows.KIND_BUG;
        }
        if (WorkItemRows.KIND_PRODUCTION_ISSUE.equals(trimmed) || "PROD_ISSUE".equals(trimmed) || "PROD".equals(trimmed)) {
            return WorkItemRows.KIND_PRODUCTION_ISSUE;
        }
        if (trimmed.isEmpty() || WorkItemRows.KIND_TASK.equals(trimmed)) {
            return WorkItemRows.KIND_TASK;
        }
        throw new IllegalArgumentException("A submission is a TASK, a BUG, or a PRODUCTION_ISSUE.");
    }

    private boolean approve(String decision) {
        String value = upper(decision);
        if ("APPROVE".equals(value) || "APPROVED".equals(value)) {
            return true;
        }
        if ("REJECT".equals(value) || "REJECTED".equals(value)) {
            return false;
        }
        throw new IllegalArgumentException("Decide APPROVE or REJECT.");
    }

    /**
     * Priorities are rows in app_lookup, so the server accepts what the list
     * offers and falls back to the list's middle value when nothing is sent.
     */
    private String priority(String value) {
        String trimmed = trim(value);
        if (trimmed.isEmpty()) {
            List<String> codes = referenceService.codes(ReferenceService.PRIORITY);
            if (codes.isEmpty()) {
                return null;
            }
            return codes.get(codes.size() > 1 ? 1 : 0);
        }
        if (!referenceService.isActiveCode(ReferenceService.PRIORITY, trimmed)) {
            throw new IllegalArgumentException("Unknown priority: " + value);
        }
        return trimmed.toUpperCase(Locale.ROOT);
    }

    /** Optional attachment, stored beside the ones the create screen writes. */
    private String storeAttachment(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return null;
        }
        File uploadPath = new File(pathDirectory);
        if (!uploadPath.exists()) {
            uploadPath.mkdirs();
        }
        String orig = file.getOriginalFilename();
        String safeName = System.currentTimeMillis() + "_" + (orig == null ? "file.png" : orig.replaceAll("[^a-zA-Z0-9._-]", "_"));
        File destFile = new File(uploadPath, safeName);
        file.transferTo(destFile);
        return safeName;
    }

    /** Stores a base64 encoded data URI (e.g. data:image/png;base64,...) as an image file on disk. */
    private String storeBase64Image(String base64Data, String defaultPrefix) throws IOException {
        if (base64Data == null || !base64Data.contains(",")) {
            return null;
        }
        String[] parts = base64Data.split(",", 2);
        byte[] bytes = java.util.Base64.getDecoder().decode(parts[1]);
        File uploadPath = new File(pathDirectory);
        if (!uploadPath.exists()) {
            uploadPath.mkdirs();
        }
        String safeName = System.currentTimeMillis() + "_" + defaultPrefix + ".png";
        File destFile = new File(uploadPath, safeName);
        java.nio.file.Files.write(destFile.toPath(), bytes);
        return safeName;
    }

    /** yyyy-MM-dd from the assign dialog; anything else is a correctable error. */
    private Date parseDate(String value) {
        try {
            LocalDate day = LocalDate.parse(value.trim().substring(0, 10));
            return Date.from(day.atStartOfDay(ZoneId.systemDefault()).toInstant());
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("Dates must look like 2026-11-12.");
        }
    }

    private Date startOfToday() {
        return Date.from(LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant());
    }

    private Date daysFromToday(int days) {
        return Date.from(LocalDate.now().plusDays(days).atStartOfDay(ZoneId.systemDefault()).toInstant());
    }

    private ResponseEntity<?> forbidden(String message) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(message);
    }

    private ResponseEntity<?> failure(RuntimeException e) {
        if (e instanceof NoSuchElementException) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
        if (e instanceof AccessDeniedException) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
        return ResponseEntity.badRequest().body(e.getMessage());
    }

    private String required(String value, String message) {
        String trimmed = trim(value);
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException(message);
        }
        return trimmed;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private String upper(String value) {
        return trim(value).toUpperCase(Locale.ROOT);
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }
}
