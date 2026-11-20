package canteenManagment.main.service;

import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import canteenManagment.main.DTO.TaskUpdateRequest;
import canteenManagment.main.DTO.assignTaskDTO;
import canteenManagment.main.UserEntity.AssignTask;
import canteenManagment.main.UserEntity.ApprovalState;
import canteenManagment.main.UserEntity.DeletedTask;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.UserEntity.WorkStatus;
import canteenManagment.main.userReposerity.DeletedTaskRepository;
import canteenManagment.main.userReposerity.UserRepository;
import canteenManagment.main.userReposerity.assignTaskRepository;
import canteenManagment.main.reference.ReferenceService;
import canteenManagment.main.security.AuthContext;
import org.springframework.beans.factory.annotation.Value;
import java.io.File;
import java.time.LocalDateTime;




@Service
public class assingTaskService {


@Value("${file.upload-dir}")
private String pathDirectory;

    @Autowired
    private assignTaskRepository assignTaskRepository;

    @Autowired
    private canteenManagment.main.userReposerity.AssignBugRepository assignBugRepository;
     
    @Autowired
    private DeletedTaskRepository DeletedTaskRepository ;
    
    @Autowired
    private  UserRepository UserRepository ; 
    
    /** Used for the same role check the controllers apply to task management. */
    @Autowired
    private UserService userService;

    /** Assignment notices: the owner is told when work is handed to them. */
    @Autowired
    private TaskMailService taskMailService;

    /** Priorities are rows in app_lookup, so the server accepts what the UI offers. */
    @Autowired
    private ReferenceService referenceService;

    @Autowired
    private ProjectSequenceService projectSequenceService;
    
    public AssignTask saveTask(assignTaskDTO dto) throws IOException {
        if (dto == null || dto.getProject() == null || dto.getProject().trim().isEmpty()) {
            throw new IllegalArgumentException("Choose a project for this task.");
        }
        if (dto.getAssignedTo() == null || dto.getAssignedTo().trim().isEmpty()) {
            throw new IllegalArgumentException("Choose who the task belongs to.");
        }
        AssignTask task = new AssignTask();
        task.setProject(dto.getProject().toUpperCase());
        if(dto.getTaskTitle()!=null && !dto.getTaskTitle().equals("undefined")) {
        task.setTaskTitle(dto.getTaskTitle().toUpperCase());
        }else {
        	task.setTaskTitle("EMR".toUpperCase());
        }
        String username = dto.getAssignedTo().trim().toUpperCase(); 
        Long ownerId;
        try {
            ownerId = Long.valueOf(username);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("That assignee does not exist any more.");
        }
        UserEntity user = UserRepository.findById(ownerId)
                        .orElseThrow(() -> new IllegalArgumentException("That assignee does not exist any more."));

        task.setAssignedTo(user);
        
        task.setStartDate(dto.getStartDate());
        task.setEndDate(dto.getEndDate());
        task.setPriority(priority(dto.getPriority()));
        task.setModule(upper(dto.getModule(), ""));
        task.setSubModule(upper(dto.getSubModule(), ""));
        task.setScreen(upper(dto.getScreen(), ""));
        task.setDescription(upper(dto.getDescription(), ""));
        // New work starts in TODO; the assignee moves it from their board.
        task.setStatus(WorkStatus.TODO);
        // Created by a manager and handed out in one step: nothing to approve.
        task.setKind("TASK");
        task.setApprovalState(ApprovalState.NOT_REQUIRED);
        task.setAssignedAt(new Date());
        
        MultipartFile file = dto.getAttachment();
        // The attachment is optional: without this guard a task created with no
        // file fails on a NullPointerException.
        if (file == null || file.isEmpty()) {
            return stampCode(assignTaskRepository.save(task));
        }
        File uploadPath = new File(pathDirectory);
        if (!uploadPath.exists()) {
            uploadPath.mkdirs(); 
        }
        String originalFilename = file.getOriginalFilename();
        File destFile = new File(uploadPath, originalFilename);
        file.transferTo(destFile);
         task .setAttachmentPath(originalFilename);
         
        return stampCode(assignTaskRepository.save(task));
    }

    /**
     * Gives the row its permanent code once the record id exists - "TASK-00042"
     * for a task, "BUG-00007" for a bug. The id is a counter that is never
     * reused and the prefix separates the two kinds, so the code is unique and
     * stays the same through approval, assignment, development and testing.
     */
    public AssignTask stampCode(AssignTask saved) {
        if (saved == null || (saved.getTaskCode() != null && !saved.getTaskCode().trim().isEmpty())) {
            return saved;
        }
        saved.setTaskCode(projectSequenceService.nextCode(saved.getKind(), saved.getProject()));
        return assignTaskRepository.save(saved);
    }

    /** Trimmed, upper-cased text; the legacy schema stores these fields in caps. */
    private String upper(String value, String fallback) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.isEmpty() ? fallback : trimmed.toUpperCase();
    }

    /**
     * Priority has to be one of the values in app_lookup. When the client sends
     * nothing, the list's own middle value is used, so reordering the list in the
     * database also moves the default.
     */
    private String priority(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (!trimmed.isEmpty()) {
            if (!referenceService.isActiveCode(ReferenceService.PRIORITY, trimmed)) {
                throw new IllegalArgumentException("Unknown priority: " + value);
            }
            return trimmed.toUpperCase(java.util.Locale.ROOT);
        }
        List<String> codes = referenceService.codes(ReferenceService.PRIORITY);
        if (codes.isEmpty()) {
            return null;
        }
        return codes.get(codes.size() > 1 ? 1 : 0);
    }

    /**
     * Edits an existing assignment in place. The status is deliberately untouched:
     * progress moves through WorkflowService so every step stays in the history.
     */
    public AssignTask updateTask(Long id, TaskUpdateRequest request, String actorEmail) {
        AssignTask task = null;
        boolean isBug = false;
        String reqKind = request != null ? request.getKind() : null;
        if ("BUG".equalsIgnoreCase(reqKind)) {
            task = assignBugRepository.findById(id).orElse(null);
            isBug = true;
        } else if ("TASK".equalsIgnoreCase(reqKind)) {
            task = assignTaskRepository.findById(id).orElse(null);
        } else {
            task = assignBugRepository.findById(id).orElse(null);
            if (task != null) {
                isBug = true;
            } else {
                task = assignTaskRepository.findById(id).orElse(null);
            }
        }
        if (task == null) {
            throw new NoSuchElementException("That task/bug does not exist any more.");
        }
        if (request == null) {
            throw new IllegalArgumentException("Send the fields you want to change.");
        }
        String previousOwner = task.getAssignedTo() == null ? null : task.getAssignedTo().getEmail();
        if (request.getTaskTitle() != null) {
            String title = request.getTaskTitle().trim();
            if (title.isEmpty()) {
                throw new IllegalArgumentException("Give the task a title.");
            }
            task.setTaskTitle(title.toUpperCase());
        }
        if (request.getProject() != null && !request.getProject().trim().isEmpty()) {
            task.setProject(request.getProject().trim().toUpperCase());
        }
        if (request.getAssignedTo() != null) {
            UserEntity owner = UserRepository.findById(request.getAssignedTo())
                    .orElseThrow(() -> new IllegalArgumentException("That assignee does not exist any more."));
            task.setAssignedTo(owner);
        }
        if (request.getStartDate() != null && !request.getStartDate().trim().isEmpty()) {
            task.setStartDate(parseDate(request.getStartDate()));
        }
        if (request.getEndDate() != null && !request.getEndDate().trim().isEmpty()) {
            task.setEndDate(parseDate(request.getEndDate()));
        }
        if (request.getPriority() != null) {
            task.setPriority(priority(request.getPriority()));
        }
        if (request.getModule() != null) {
            task.setModule(upper(request.getModule(), ""));
        }
        if (request.getSubModule() != null) {
            task.setSubModule(upper(request.getSubModule(), ""));
        }
        if (request.getScreen() != null) {
            task.setScreen(upper(request.getScreen(), ""));
        }
        if (request.getDescription() != null) {
            task.setDescription(upper(request.getDescription(), ""));
        }
        if (request.getLeadNotes() != null) {
            task.setLeadNotes(request.getLeadNotes().trim());
            task.setLeadNotesUpdatedBy(actorEmail);
            task.setLeadNotesUpdatedAt(new Date());
        }
        AssignTask saved = isBug
                ? assignBugRepository.save((canteenManagment.main.UserEntity.AssignBug) task)
                : assignTaskRepository.save(task);
        // A reassignment is an assignment as far as the new owner is concerned:
        // only a real change of hands is worth a mail.
        String newOwner = saved.getAssignedTo() == null ? null : saved.getAssignedTo().getEmail();
        if (newOwner != null && !newOwner.equalsIgnoreCase(previousOwner == null ? "" : previousOwner)) {
            taskMailService.taskAssigned(saved, actorEmail);
        }
        return saved;
    }

    /** yyyy-MM-dd from the dialog; anything else is a correctable input error. */
    private Date parseDate(String value) {
        try {
            LocalDate day = LocalDate.parse(value.trim().substring(0, 10));
            return Date.from(day.atStartOfDay(ZoneId.systemDefault()).toInstant());
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("Dates must look like 2026-11-12.");
        }
    }
    
    public boolean deleteTaskById(Long id) {
        if (assignBugRepository.existsById(id)) {
            assignBugRepository.deleteById(id);
            return true;
        }
        if (assignTaskRepository.existsById(id)) {
        	assignTaskRepository.deleteById(id);
            return true;
        } else {
            return false;
        }
    }
    
    public boolean deleteTaskWithReason(Long taskId, String reason, String ignoredDeletedBy, Authentication authentication) {
        AssignTask task = assignBugRepository.findById(taskId).map(b -> (AssignTask) b)
                .orElseGet(() -> assignTaskRepository.findById(taskId).orElse(null));
        if (task != null) {
            boolean isBug = task instanceof canteenManagment.main.UserEntity.AssignBug || "BUG".equalsIgnoreCase(task.getKind());
            // The audit trail must name the caller, not a value from the request
            // body. Admins and testers holding the task provision may remove any
            // assignment; everyone else only their own.
            String caller = AuthContext.email(authentication);
            String owner = task.getAssignedTo() == null ? null : task.getAssignedTo().getEmail();
            if (!userService.canManageTasks(authentication)
                    && (owner == null || !owner.equalsIgnoreCase(caller))) {
                throw new AccessDeniedException("You can only delete work that is assigned to you.");
            }
            DeletedTask deleted = new DeletedTask();
            deleted.setTaskId(task.getId());
            // The audit keeps the code the item was known by, so the archive can
            // still say "BUG-01" after the row itself is gone.
            deleted.setTaskCode(task.codeOrGenerated());
            deleted.setKind(WorkItemRows.kindOf(task));
            deleted.setTaskName(task.getDescription());
            deleted.setReason(reason);
            deleted.setDeletedBy(caller);
            deleted.setDeletedDate(LocalDateTime.now());
            DeletedTaskRepository.save(deleted);

            if (isBug) {
                assignBugRepository.deleteById(taskId);
            } else {
                assignTaskRepository.deleteById(taskId);
            }
            return true;
        }
        return false;
    }

    
    
}
