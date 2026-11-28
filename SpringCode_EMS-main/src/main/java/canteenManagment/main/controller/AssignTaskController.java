package canteenManagment.main.controller;

import java.util.List; // ✅ Import this
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import canteenManagment.main.DTO.TaskDeleteRequest;
import canteenManagment.main.DTO.StatusUpdateRequest;
import canteenManagment.main.DTO.TaskUpdateRequest;
import canteenManagment.main.DTO.assignTaskDTO;
import canteenManagment.main.UserEntity.AssignTask;
import canteenManagment.main.UserEntity.ApprovalState;
import canteenManagment.main.UserEntity.DeletedTask;
import canteenManagment.main.UserEntity.MasterProjectTbl;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.UserEntity.UserIdName;
import canteenManagment.main.UserEntity.StatusChange;
import canteenManagment.main.UserEntity.WorkStatus;
import canteenManagment.main.master.MasterDataService;
import canteenManagment.main.master.MasterEntry;
import canteenManagment.main.service.assingTaskService; 
import canteenManagment.main.service.TaskMailService;
import canteenManagment.main.service.UserService;
import canteenManagment.main.service.WorkItemRows;
import canteenManagment.main.service.WorkflowService;
import canteenManagment.main.security.AuthContext;
import canteenManagment.main.security.Roles;
import canteenManagment.main.userReposerity.DeletedTaskRepository;
import canteenManagment.main.userReposerity.UserRepository;
import canteenManagment.main.userReposerity.MasterProjectRepository;
import canteenManagment.main.userReposerity.assignTaskRepository;

import org.springframework.data.domain.Sort;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.io.IOException;
import java.nio.file.Paths;
import java.time.LocalDateTime;




@RestController
@RequestMapping("/api/assigntasks")
public class AssignTaskController {
	  private final assingTaskService assingTaskService;
	  private final UserRepository UserRepository; 
	  private final MasterProjectRepository MasterProjectRepository;
	  private final assignTaskRepository assignTaskRepository;
	  private final canteenManagment.main.userReposerity.AssignBugRepository assignBugRepository;
	  // The module / sub module / screen pickers read the admin-maintained master
	  // data rather than deriving names from the tasks already created.
	  private final MasterDataService masterDataService;
  private final WorkflowService workflowService;
  private final UserService userService;
  private final DeletedTaskRepository deletedTaskRepository;
  private final TaskMailService taskMailService;

  @Autowired(required = false)
  private canteenManagment.main.hierarchy.TeamHierarchyService hierarchyService;
	  

	    @Autowired
	    public AssignTaskController(assingTaskService assingTaskService,UserRepository UserRepository, MasterProjectRepository MasterProjectRepository,assignTaskRepository assignTaskRepository, canteenManagment.main.userReposerity.AssignBugRepository assignBugRepository, MasterDataService masterDataService, WorkflowService workflowService, UserService userService, DeletedTaskRepository deletedTaskRepository, TaskMailService taskMailService) {
	        this.assingTaskService = assingTaskService;
			this.UserRepository =UserRepository;
			this.MasterProjectRepository = MasterProjectRepository;
			this.assignTaskRepository= assignTaskRepository;
			this.assignBugRepository = assignBugRepository;
			this.masterDataService = masterDataService;
			this.workflowService = workflowService;
			this.userService = userService;
			this.deletedTaskRepository = deletedTaskRepository;
			this.taskMailService = taskMailService;
	    }

		@PostMapping(value = "/create", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
		public ResponseEntity<?> createTask(@ModelAttribute assignTaskDTO assignTaskDTO,
				org.springframework.security.core.Authentication authentication) {
			// Creating work is a management action: admins, plus testers an admin
			// has granted task access. Developers never reach this endpoint.
			if (!userService.canManageTasks(authentication)) {
				return ResponseEntity.status(HttpStatus.FORBIDDEN)
						.body("Only an administrator, or a tester with task access, can create tasks.");
			}
			// A tester's own work is raised through the intake (Raise task / bug)
			// so the testing team leader sees it first. Their task-access
			// provision covers the register and edits, not handing out work.
			if (AuthContext.hasRole(authentication, AuthContext.ROLE_TESTER)
					&& !AuthContext.hasRole(authentication, AuthContext.ROLE_TESTER_LEAD)
					&& !AuthContext.hasRole(authentication, AuthContext.ROLE_TEAM_LEAD)) {
				return ResponseEntity.status(HttpStatus.FORBIDDEN)
						.body("Raise a task or a bug from Raise task / bug. Your team leader approves it before it is assigned.");
			}

			// Verify that project work is authorized by the CEO/Director
			if (hierarchyService != null && assignTaskDTO.getProject() != null && !assignTaskDTO.getProject().trim().isEmpty()) {
				if (!hierarchyService.isProjectWorkAuthorized(assignTaskDTO.getProject().trim()) && !AuthContext.isAdmin(authentication)) {
					return ResponseEntity.status(HttpStatus.FORBIDDEN)
							.body("Project work for '" + assignTaskDTO.getProject().trim() + "' has not been authorized. Team hierarchy must be approved by the CEO/Director before work can begin.");
				}
				if (assignTaskDTO.getAssignedTo() != null && !assignTaskDTO.getAssignedTo().trim().isEmpty()) {
					try {
						Long devId = Long.valueOf(assignTaskDTO.getAssignedTo().trim());
						if (!hierarchyService.isDeveloperAssignedToProject(assignTaskDTO.getProject().trim(), devId, null)) {
							return ResponseEntity.badRequest().body("Assigned developer is not part of the Team Hierarchy for project '" + assignTaskDTO.getProject().trim() + "'. Only assigned project members can receive work.");
						}
					} catch (NumberFormatException ignored) {
					}
				}
			}
			try {
				AssignTask savedTask = assingTaskService.saveTask(assignTaskDTO);
				// The new owner is told straight away; a mail problem is logged
				// inside the service and never fails the creation.
				taskMailService.taskAssigned(savedTask, AuthContext.email(authentication));
				return ResponseEntity.status(HttpStatus.CREATED).body(savedTask);
			} catch (IllegalArgumentException e) {
				// A picked assignee that no longer exists, or a missing project: a
				// correctable input problem, not a server fault.
				return ResponseEntity.badRequest().body(e.getMessage());
			} catch (Exception e) {
				e.printStackTrace();
				return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Task creation failed.");
			}
		}
		@GetMapping("/getAssignTask")
		public List<AssignTask> getAssignTaskList(@RequestParam(required = false) String email,
				org.springframework.security.core.Authentication authentication) {
		    // "Mine" means the row's owner. A board asks for another person only when
		    // it was opened by somebody who runs a team: the CEO reads anybody's, a team
		    // leader only a person in their own family, and anything else is answered
		    // from the caller's own list so the parameter can never widen a view.
		    boolean ceo = AuthContext.isAdmin(authentication);
		    boolean explicitEmail = email != null && !email.isEmpty() && !email.equalsIgnoreCase("null");
		    String callerEmail = AuthContext.email(authentication);

		    UserEntity viewer = UserRepository.findByEmailIgnoreCase(callerEmail)
		        .orElseGet(() -> UserRepository.findByEmail(callerEmail)
		            .orElseThrow(() -> new RuntimeException("User not found with email: " + callerEmail)));
		    UserEntity target = viewer;

		    if (explicitEmail && AuthContext.isManager(authentication)) {
		        UserEntity requested = UserRepository.findByEmailIgnoreCase(email).orElse(null);
		        boolean sameTeam = requested != null
		                && Roles.family(viewer.getRole()).equals(Roles.family(requested.getRole()));
		        if (requested != null && (ceo || sameTeam)) {
		            target = requested;
		        }
		    }

		    // The CEO reads every row when the request names nobody; that is the
		    // whole-workspace view the admin dashboard is built on.
		    List<AssignTask> tasks = new java.util.ArrayList<>();
		    if (ceo && !explicitEmail) {
		        tasks.addAll(assignTaskRepository.findAll());
		        tasks.addAll(assignBugRepository.findAll());
		    } else {
		        tasks.addAll(assignTaskRepository.findByAssignedTo_Id(target.getId()));
		        tasks.addAll(assignBugRepository.findByAssignedTo_Id(target.getId()));

		        // Also include tasks/bugs assigned to target for QA testing
		        Long targetId = target.getId();
		        String targetEmail = target.getEmail();
		        assignTaskRepository.findAll().stream()
		                .filter(t -> (t.getAssignedTesterId() != null && Objects.equals(t.getAssignedTesterId(), targetId))
		                        || (t.getAssignedTester() != null && Objects.equals(t.getAssignedTester().getId(), targetId))
		                        || (targetEmail != null && t.getAssignedTesterEmail() != null && targetEmail.trim().equalsIgnoreCase(t.getAssignedTesterEmail().trim()))
		                        || (t.getAssignedTester() != null && targetEmail != null && t.getAssignedTester().getEmail() != null && targetEmail.trim().equalsIgnoreCase(t.getAssignedTester().getEmail().trim())))
		                .filter(t -> tasks.stream().noneMatch(existing -> Objects.equals(existing.getId(), t.getId()) && (existing.getKind() == null || "TASK".equalsIgnoreCase(existing.getKind()))))
		                .forEach(tasks::add);

		        assignBugRepository.findAll().stream()
		                .filter(t -> (t.getAssignedTesterId() != null && Objects.equals(t.getAssignedTesterId(), targetId))
		                        || (t.getAssignedTester() != null && Objects.equals(t.getAssignedTester().getId(), targetId))
		                        || (targetEmail != null && t.getAssignedTesterEmail() != null && targetEmail.trim().equalsIgnoreCase(t.getAssignedTesterEmail().trim()))
		                        || (t.getAssignedTester() != null && targetEmail != null && t.getAssignedTester().getEmail() != null && targetEmail.trim().equalsIgnoreCase(t.getAssignedTester().getEmail().trim())))
		                .filter(t -> tasks.stream().noneMatch(existing -> Objects.equals(existing.getId(), t.getId()) && "BUG".equalsIgnoreCase(existing.getKind())))
		                .forEach(tasks::add);
		    }

		    return tasks.stream().map(this::rowOf).collect(Collectors.toList());
		}

		/**
		 * The whole register of approved tasks and bugs for boards and registers.
		 * Allows team members to view work across projects and team members (read-only for non-assignees).
		 */
		@GetMapping("/register")
		public ResponseEntity<?> register(org.springframework.security.core.Authentication authentication) {
			// Work still inside the testing team (pending or sent back) is not
			// work yet: it belongs to the intake lists, not to the board.
			List<AssignTask> allItems = new java.util.ArrayList<>();
			allItems.addAll(assignTaskRepository.findAll());
			allItems.addAll(assignBugRepository.findAll());
			return ResponseEntity.ok(allItems.stream()
					.filter((task) -> !ApprovalState.orDefault(task.getApprovalState()).isInIntake())
					.map(this::rowOf)
					.collect(Collectors.toList()));
		}

		/**
		 * The audit list behind the Task Board's delete action: who removed what and
		 * why. The CEO only: this is the accountability record, not day-to-day work.
		 * Newest removal first.
		 */
		@GetMapping("/deleted")
		public ResponseEntity<?> deletedTasks(org.springframework.security.core.Authentication authentication) {
			if (!AuthContext.isAdmin(authentication)) {
				return ResponseEntity.status(HttpStatus.FORBIDDEN)
						.body("Only an administrator can read deleted tasks.");
			}
			return ResponseEntity.ok(deletedTaskRepository.findAll(Sort.by(Sort.Direction.DESC, "deletedDate")));
		}

		/**
		 * Edits the details of an existing assignment. Progress is not editable here;
		 * it moves through the status endpoint so the history stays complete.
		 */
		@PutMapping("/{id}")
		public ResponseEntity<?> updateTask(@PathVariable Long id,
				@RequestBody TaskUpdateRequest request,
				org.springframework.security.core.Authentication authentication) {
			if (!userService.canManageTasks(authentication)) {
				return ResponseEntity.status(HttpStatus.FORBIDDEN)
						.body("Task access is required to edit tasks.");
			}
			try {
				return ResponseEntity.ok(rowOf(assingTaskService.updateTask(id, request, AuthContext.email(authentication))));
			} catch (NoSuchElementException | org.springframework.security.access.AccessDeniedException | IllegalArgumentException e) {
				return failure(e);
			}
		}

		/**
		 * Detached copy of a stored assignment for the read endpoints: the assignee
		 * arrives as a plain name so the browser never sees the embedded account.
		 * The shaping lives in WorkItemRows so the intake endpoints return exactly
		 * the same row shape as the boards.
		 */
		private AssignTask rowOf(AssignTask task) {
			return WorkItemRows.of(task);
		}
		
		/**
		 * Employee-side progress update: the assignee may move their own assignment,
		 * an admin may move anyone's. Each transition is appended to status_history.
		 */
		@PatchMapping("/{id}/status")
		public ResponseEntity<?> updateStatus(@PathVariable Long id,
				@RequestParam(required = false) String kind,
				@RequestBody StatusUpdateRequest request,
				org.springframework.security.core.Authentication authentication) {
			try {
				return ResponseEntity.ok(workflowService.changeAssignmentStatus(id, kind, request, authentication));
			} catch (NoSuchElementException | org.springframework.security.access.AccessDeniedException | IllegalArgumentException e) {
				return failure(e);
			}
		}
		
		@GetMapping("/{id}/history")
		public ResponseEntity<?> history(@PathVariable Long id,
				org.springframework.security.core.Authentication authentication) {
			try {
				List<StatusChange> changes = workflowService.history(WorkflowService.ASSIGNMENT, id, authentication);
				return ResponseEntity.ok(changes);
			} catch (NoSuchElementException | org.springframework.security.access.AccessDeniedException | IllegalArgumentException e) {
				return failure(e);
			}
		}
		
		private ResponseEntity<?> failure(RuntimeException e) {
			if (e instanceof NoSuchElementException) {
				return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
			}
			if (e instanceof org.springframework.security.access.AccessDeniedException) {
				return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
			}
			return ResponseEntity.badRequest().body(e.getMessage());
		}


		
		/*@GetMapping("/attachments/{filename:.+}")
		public ResponseEntity<Resource> getImage(@PathVariable String filename) throws IOException {
		    Path path = (Path) Paths.get("C:/Users/anilkumar.s/Documents/canteenManagment/CanteenImages/").resolve(filename).normalize();
		    Resource resource = new UrlResource(((java.nio.file.Path) path).toUri());

		    if (((Resource) resource).exists()) {
		        return ResponseEntity.ok()
		            .contentType(MediaType.IMAGE_PNG) 
		            .body(resource);
		    } else {
		        return ResponseEntity.notFound().build();
		    }
		}*/
		/**
		 * The three pickers on the create / edit task screens. They read the
		 * master data an administrator maintains on the Master data screen, so a
		 * value added once is offered to everybody and a retired one disappears.
		 */
		@GetMapping("/getprocessDescription")
		public List<String> getprocessDescription() {
			return masterDataService.names(MasterEntry.SUB_MODULE);
		}

		@GetMapping("/getModuleDescription")
		public List<String> getAllDistinctModuleDescriptions() {
			return masterDataService.names(MasterEntry.MODULE);
		}

		@GetMapping("/getcreateDesc")
		public List<String> getcreateDesc() {
			return masterDataService.names(MasterEntry.SCREEN);
		}

		@GetMapping("/getname")
		public List<UserIdName> getname() {
		    // Only people who can actually sign in: a deactivated account must
		    // not be offered as the owner of new work.
		    return UserRepository.findAll().stream()
		            .filter(u -> !Boolean.FALSE.equals(u.getActive()))
		            .map(u -> new UserIdName(u.getId(), u.getName()))
		            .collect(Collectors.toList());
		}

		@GetMapping("/getAllProjects")
		public List<MasterProjectTbl> getAllProjects() {
			return MasterProjectRepository.findAll();
		}
		
		@GetMapping("/totalProjects")
		public ResponseEntity<Integer> getAllProjectsCount() {
			Integer count = (int) MasterProjectRepository.count();
	        return ResponseEntity.ok(count);
			
		}
		
		@PostMapping("/delete")
		public ResponseEntity<String> deleteTaskWithReason(@RequestBody TaskDeleteRequest request,
				org.springframework.security.core.Authentication authentication) {
		    try {
		        boolean deleted = assingTaskService.deleteTaskWithReason(
		                request.getTaskId(), request.getReason(), request.getDeletedBy(), authentication);
		        if (deleted) {
		            return ResponseEntity.ok("Task deleted successfully.");
		        } else {
		            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Task not found.");
		        }
		    } catch (org.springframework.security.access.AccessDeniedException e) {
		        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
		    }
		}

		
		

		
	}
