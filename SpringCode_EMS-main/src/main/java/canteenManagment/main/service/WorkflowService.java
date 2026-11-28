package canteenManagment.main.service;

import java.util.Date;
import java.util.List;
import java.util.NoSuchElementException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import canteenManagment.main.DTO.StatusUpdateRequest;
import canteenManagment.main.UserEntity.AssignTask;
import canteenManagment.main.UserEntity.StatusChange;
import canteenManagment.main.UserEntity.Task;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.UserEntity.WorkStatus;
import canteenManagment.main.security.AuthContext;
import canteenManagment.main.userReposerity.StatusChangeRepository;
import canteenManagment.main.userReposerity.TaskRepository;
import canteenManagment.main.userReposerity.UserRepository;
import canteenManagment.main.userReposerity.assignTaskRepository;

/**
 * The write side of the workspace: moves work between statuses and records who
 * did it. Both work models exist side by side (assignments drive the boards,
 * tasks drive project progress), so the transition rules are shared here
 * instead of being duplicated in the two controllers.
 *
 * Rules: an admin may move anything; every other role only the work assigned to
 * them. Repeating the current status is a no-op and writes no history row.
 */
@Service
public class WorkflowService {

    public static final String TASK = "TASK";
    public static final String ASSIGNMENT = "ASSIGNMENT";

    @Autowired private TaskRepository taskRepository;
    @Autowired private assignTaskRepository assignTaskRepository;
    @Autowired private canteenManagment.main.userReposerity.AssignBugRepository assignBugRepository;
    @Autowired private StatusChangeRepository statusChangeRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private TaskMailService taskMailService;

    public Task changeTaskStatus(Long id, StatusUpdateRequest request, Authentication authentication) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Task " + id + " does not exist."));
        WorkStatus target = WorkStatus.parse(request == null ? null : request.getStatus());
        requireOwnerOrAdmin(authentication, task.getUser() == null ? null : task.getUser().getEmail());

        WorkStatus current = WorkStatus.orDefault(task.getStatus());
        if (current == target && task.getStatus() != null) {
            return task;
        }
        requireRemarkToReopen(current, target, request);
        boolean reopening = current == WorkStatus.DONE;
        task.setStatus(target);
        if (reopening) {
            task.setReopenCount((task.getReopenCount() == null ? 0 : task.getReopenCount()) + 1);
            task.setLastReopenNote(cleanNote(request.getNote()));
        }
        Task saved = taskRepository.save(task);
        record(TASK, id, saved.getTitle(), current, target, request, authentication);
        notifyIfCompleted(current, target, saved, authentication);
        return saved;
    }

    public AssignTask changeAssignmentStatus(Long id, StatusUpdateRequest request, Authentication authentication) {
        return changeAssignmentStatus(id, null, request, authentication);
    }

    public AssignTask changeAssignmentStatus(Long id, String kind, StatusUpdateRequest request, Authentication authentication) {
        AssignTask assignment = null;
        boolean isBug = false;
        if ("BUG".equalsIgnoreCase(kind)) {
            assignment = assignBugRepository.findById(id).orElse(null);
            isBug = true;
        } else if ("TASK".equalsIgnoreCase(kind)) {
            assignment = assignTaskRepository.findById(id).orElse(null);
        } else {
            assignment = assignBugRepository.findById(id).orElse(null);
            if (assignment != null) {
                isBug = true;
            } else {
                assignment = assignTaskRepository.findById(id).orElse(null);
            }
        }
        if (assignment == null) {
            throw new NoSuchElementException("Assignment " + id + " does not exist.");
        }
        WorkStatus target = WorkStatus.parse(request == null ? null : request.getStatus());
        String devEmail = assignment.getAssignedTo() == null ? null : assignment.getAssignedTo().getEmail();
        if (devEmail == null && assignment.getAssignedToName() != null) {
            UserEntity u = userRepository.findByName(assignment.getAssignedToName()).orElse(null);
            if (u == null) {
                u = userRepository.findByEmailIgnoreCase(assignment.getAssignedToName()).orElse(null);
            }
            if (u != null) {
                devEmail = u.getEmail();
            }
        }
        String testerEmail = assignment.getAssignedTesterEmail() != null ? assignment.getAssignedTesterEmail()
                : (assignment.getAssignedTester() != null ? assignment.getAssignedTester().getEmail() : null);
        requireAssigneeOrAdmin(authentication, devEmail, testerEmail);

        WorkStatus current = WorkStatus.orDefault(assignment.getStatus());
        if (current == target && assignment.getStatus() != null) {
            return assignment;
        }
        requireRemarkToReopen(current, target, request);
        boolean reopening = current == WorkStatus.DONE;
        assignment.setStatus(target);
        if (reopening) {
            assignment.setReopenCount((assignment.getReopenCount() == null ? 0 : assignment.getReopenCount()) + 1);
            assignment.setLastReopenNote(cleanNote(request.getNote()));
            if (Boolean.TRUE.equals(assignment.getReleasedForTesting())) {
                assignment.setTestingStatus("FAILED");
                assignment.setReleasedForTesting(false);
            }
        } else if (target == WorkStatus.DONE && Boolean.TRUE.equals(assignment.getReleasedForTesting())) {
            assignment.setTestingStatus("VERIFIED");
            assignment.setVerifiedAt(new Date());
            assignment.setVerifiedBy(AuthContext.email(authentication));
        }
        AssignTask saved = isBug
                ? assignBugRepository.save((canteenManagment.main.UserEntity.AssignBug) assignment)
                : assignTaskRepository.save(assignment);
        record(ASSIGNMENT, id, saved.getTaskTitle(), current, target, request, authentication);
        notifyIfCompleted(current, target, saved, authentication);
        return saved;
    }

    /**
     * Reaching DONE is the one transition the team leads care about, so it is the
     * only one that sends mail. Re-saving an item that is already done does not.
     */
    private void notifyIfCompleted(WorkStatus current, WorkStatus target, Object saved, Authentication authentication) {
        if (target != WorkStatus.DONE || current == WorkStatus.DONE) {
            return;
        }
        String actor = AuthContext.email(authentication);
        if (saved instanceof AssignTask) {
            taskMailService.taskCompleted((AssignTask) saved, actor);
        } else if (saved instanceof Task) {
            taskMailService.taskCompleted((Task) saved, actor);
        }
    }

    public List<StatusChange> history(String entityType, Long id, Authentication authentication) {
        String type = normaliseType(entityType);
        if (TASK.equals(type)) {
            Task task = taskRepository.findById(id)
                    .orElseThrow(() -> new NoSuchElementException("Task " + id + " does not exist."));
            requireOwnerOrAdmin(authentication, task.getUser() == null ? null : task.getUser().getEmail());
        } else {
            AssignTask assignment = assignBugRepository.findById(id).map(b -> (AssignTask) b)
                    .orElseGet(() -> assignTaskRepository.findById(id).orElse(null));
            if (assignment != null) {
                String devEmail = assignment.getAssignedTo() == null ? null : assignment.getAssignedTo().getEmail();
                String testerEmail = assignment.getAssignedTesterEmail() != null ? assignment.getAssignedTesterEmail()
                        : (assignment.getAssignedTester() != null ? assignment.getAssignedTester().getEmail() : null);
                requireAssigneeOrAdmin(authentication, devEmail, testerEmail);
            }
        }
        return statusChangeRepository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(type, id);
    }

    private String normaliseType(String entityType) {
        String value = entityType == null ? "" : entityType.trim().toUpperCase();
        if (TASK.equals(value) || ASSIGNMENT.equals(value)) {
            return value;
        }
        throw new IllegalArgumentException("Unknown work type \"" + entityType + "\". Use task or assignment.");
    }

    /**
     * Done is terminal: re-opening completed work needs a written reason, so the
     * audit row explains the move instead of only recording who made it.
     */
    private void requireRemarkToReopen(WorkStatus current, WorkStatus target, StatusUpdateRequest request) {
        if (current == WorkStatus.DONE && target != WorkStatus.DONE
                && cleanNote(request == null ? null : request.getNote()) == null) {
            throw new IllegalArgumentException(
                    "This item is already done. Add a remark explaining why it is moving back.");
        }
    }

    /**
     * The person who owns the work moves it; a manager may move it for them.
     * The CEO and both team leaders run the queue, so they are not limited to
     * the rows addressed to themselves.
     */
    private void requireOwnerOrAdmin(Authentication authentication, String ownerEmail) {
        if (AuthContext.isManager(authentication)) {
            return;
        }
        String caller = AuthContext.email(authentication);
        if (ownerEmail == null || !ownerEmail.toLowerCase().equals(caller)) {
            throw new AccessDeniedException("You can only move work that is assigned to you.");
        }
    }

    private void requireAssigneeOrAdmin(Authentication authentication, String ownerEmail, String testerEmail) {
        if (AuthContext.isManager(authentication)) {
            return;
        }
        String caller = AuthContext.email(authentication);
        if (caller == null) {
            throw new AccessDeniedException("You are not authenticated.");
        }
        boolean isOwner = ownerEmail != null && ownerEmail.equalsIgnoreCase(caller);
        boolean isTester = testerEmail != null && testerEmail.equalsIgnoreCase(caller);
        if (!isOwner && !isTester) {
            throw new AccessDeniedException("You can only move work that is assigned to you.");
        }
    }

    private void record(String type, Long id, String title, WorkStatus from, WorkStatus to,
                        StatusUpdateRequest request, Authentication authentication) {
        String actorEmail = AuthContext.email(authentication);
        StatusChange change = new StatusChange();
        change.setEntityType(type);
        change.setEntityId(id);
        change.setEntityTitle(title);
        change.setFromStatus(from);
        change.setToStatus(to);
        change.setActorEmail(actorEmail);
        change.setActorName(actorName(actorEmail));
        change.setNote(cleanNote(request == null ? null : request.getNote()));
        change.setChangedAt(new Date());
        statusChangeRepository.save(change);
    }

    private String cleanNote(String note) {
        if (note == null || note.trim().isEmpty()) {
            return null;
        }
        String trimmed = note.trim();
        return trimmed.length() > 500 ? trimmed.substring(0, 500) : trimmed;
    }

    private String actorName(String email) {
        return userRepository.findByEmail(email)
                .map(UserEntity::getName)
                .orElse(null);
    }
}
