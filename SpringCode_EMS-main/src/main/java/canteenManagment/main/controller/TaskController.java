package canteenManagment.main.controller;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import canteenManagment.main.DTO.StatusUpdateRequest;
import canteenManagment.main.UserEntity.StatusChange;
import canteenManagment.main.UserEntity.Task;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.security.AuthContext;
import canteenManagment.main.service.TaskService;
import canteenManagment.main.service.WorkflowService;
import canteenManagment.main.userReposerity.UserRepository;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    @Autowired
    private TaskService taskService;

    @Autowired
    private WorkflowService workflowService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Admins read the whole board; every other role only receives the tasks that
     * are assigned to them, so the dashboards of the three logins differ.
     */
    @GetMapping
    public ResponseEntity<List<Task>> getAllTasks(Authentication authentication) {
        List<Task> tasks = taskService.getAll();

        if (!AuthContext.isAdmin(authentication)) {
            String email = AuthContext.email(authentication);
            tasks = tasks.stream()
                    .filter(task -> task.getUser() != null
                            && task.getUser().getEmail() != null
                            && task.getUser().getEmail().equalsIgnoreCase(email))
                    .collect(Collectors.toList());
        }

        return ResponseEntity.ok(tasks);
    }

    @PostMapping
    public ResponseEntity<?> createTask(@RequestBody Task task) {
        // The owner is embedded in the task, and the employee dashboards match on
        // that embedded email. A body carrying only {"user":{"id":7}} would save
        // a task nobody can see, so always store the resolved record.
        if (task.getUser() == null || task.getUser().getId() == null) {
            return ResponseEntity.badRequest().body("Choose who the task belongs to.");
        }
        UserEntity owner = userRepository.findById(task.getUser().getId()).orElse(null);
        if (owner == null) {
            return ResponseEntity.badRequest().body("That assignee does not exist any more.");
        }
        task.setUser(owner);
        return ResponseEntity.ok(taskService.save(task));
    }

    /**
     * Moves a task through TODO → IN_PROGRESS → IN_REVIEW → DONE. The assignee
     * may update their own task, an admin may update any; the transition is
     * written to {@code status_history} so the activity feed is auditable.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id,
                                          @RequestBody StatusUpdateRequest request,
                                          Authentication authentication) {
        try {
            return ResponseEntity.ok(workflowService.changeTaskStatus(id, request, authentication));
        } catch (NoSuchElementException | AccessDeniedException | IllegalArgumentException e) {
            return failure(e);
        }
    }

    /**
     * Removes a work item from the portfolio. Until now tasks could be created
     * but never withdrawn, so a task raised by mistake stayed on every board
     * forever; only an administrator may do this.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTask(@PathVariable Long id, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only an administrator can remove a task");
        }
        if (!taskService.exists(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Task " + id + " does not exist.");
        }
        taskService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<?> history(@PathVariable Long id, Authentication authentication) {
        try {
            List<StatusChange> changes = workflowService.history(WorkflowService.TASK, id, authentication);
            return ResponseEntity.ok(changes);
        } catch (NoSuchElementException | AccessDeniedException | IllegalArgumentException e) {
            return failure(e);
        }
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
}
