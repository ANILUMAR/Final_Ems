package canteenManagment.main.hierarchy;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import canteenManagment.main.security.AuthContext;

@RestController
@RequestMapping("/api/hierarchy")
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class TeamHierarchyController {

    @Autowired
    private TeamHierarchyService hierarchyService;

    @GetMapping
    public ResponseEntity<List<TeamHierarchy>> getAll() {
        return ResponseEntity.ok(hierarchyService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable String id) {
        try {
            return ResponseEntity.ok(hierarchyService.getById(id));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/candidates")
    public ResponseEntity<Map<String, Object>> getCandidates() {
        return ResponseEntity.ok(hierarchyService.getCandidates());
    }

    @GetMapping("/projects")
    public ResponseEntity<List<ProjectRosterDto>> getProjectRosters() {
        return ResponseEntity.ok(hierarchyService.getProjectRosters());
    }

    @GetMapping("/my-projects")
    public ResponseEntity<List<ProjectRosterDto>> getMyProjects(Authentication authentication) {
        String email = AuthContext.email(authentication);
        boolean isAdmin = AuthContext.isAdmin(authentication);
        return ResponseEntity.ok(hierarchyService.getAssignedProjectsForUser(email, isAdmin));
    }

    @PostMapping("/projects/create")
    public ResponseEntity<?> createProject(@RequestBody Map<String, String> body, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication) && !AuthContext.hasRole(authentication, AuthContext.ROLE_PROJECT_MANAGER)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only administrators and Project Managers can create projects."));
        }
        try {
            String name = body.get("name");
            String description = body.get("description");
            return ResponseEntity.status(HttpStatus.CREATED).body(hierarchyService.createProjectFromHierarchy(name, description));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/projects/assign")
    public ResponseEntity<?> assignProjectTeam(@RequestBody ProjectTeamAssignRequest request, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication) && !AuthContext.hasRole(authentication, AuthContext.ROLE_PROJECT_MANAGER)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only administrators and Project Managers can assign project teams."));
        }
        try {
            ProjectRosterDto roster = hierarchyService.assignProjectTeam(request, AuthContext.email(authentication));
            return ResponseEntity.ok(roster);
        } catch (IllegalArgumentException | NoSuchElementException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/projects/{projectName}/submit")
    public ResponseEntity<?> submitProjectHierarchy(@PathVariable String projectName,
                                                    @RequestBody(required = false) Map<String, String> body,
                                                    Authentication authentication) {
        if (!AuthContext.isAdmin(authentication) && !AuthContext.hasRole(authentication, AuthContext.ROLE_PROJECT_MANAGER)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only Project Managers and Administrators can submit team hierarchies for approval."));
        }
        try {
            String notes = body != null ? body.get("notes") : null;
            hierarchyService.submitHierarchyForApproval(projectName, AuthContext.email(authentication), notes);
            return ResponseEntity.ok(hierarchyService.buildRosterForProject(projectName));
        } catch (IllegalArgumentException | NoSuchElementException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/projects/{projectName}/approve")
    public ResponseEntity<?> approveProjectHierarchy(@PathVariable String projectName,
                                                     @RequestBody(required = false) Map<String, String> body,
                                                     Authentication authentication) {
        if (!AuthContext.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only the CEO / Super Administrator can approve project team hierarchies and authorize project work."));
        }
        try {
            String remarks = body != null ? body.get("remarks") : null;
            hierarchyService.approveHierarchy(projectName, AuthContext.email(authentication), remarks);
            return ResponseEntity.ok(hierarchyService.buildRosterForProject(projectName));
        } catch (IllegalArgumentException | NoSuchElementException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/projects/{projectName}/reject")
    public ResponseEntity<?> rejectProjectHierarchy(@PathVariable String projectName,
                                                    @RequestBody(required = false) Map<String, String> body,
                                                    Authentication authentication) {
        if (!AuthContext.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only the CEO / Super Administrator can reject project team hierarchies."));
        }
        try {
            String remarks = body != null ? body.get("remarks") : null;
            hierarchyService.rejectHierarchy(projectName, AuthContext.email(authentication), remarks);
            return ResponseEntity.ok(hierarchyService.buildRosterForProject(projectName));
        } catch (IllegalArgumentException | NoSuchElementException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/projects/{projectName}/approval")
    public ResponseEntity<?> getProjectApprovalStatus(@PathVariable String projectName) {
        try {
            return ResponseEntity.ok(hierarchyService.getOrCreateApproval(projectName));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/projects/{projectName}/members/{memberEmail}")
    public ResponseEntity<?> unassignProjectMember(@PathVariable String projectName, @PathVariable String memberEmail, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication) && !AuthContext.hasRole(authentication, AuthContext.ROLE_PROJECT_MANAGER)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only administrators and Project Managers can manage project assignments."));
        }
        try {
            ProjectRosterDto roster = hierarchyService.unassignProjectMember(projectName, memberEmail);
            return ResponseEntity.ok(roster);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/projects/{projectName}/assignment")
    public ResponseEntity<?> clearProjectHierarchy(@PathVariable String projectName, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication) && !AuthContext.hasRole(authentication, AuthContext.ROLE_PROJECT_MANAGER)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only administrators and Project Managers can clear project hierarchy."));
        }
        try {
            ProjectRosterDto roster = hierarchyService.clearProjectHierarchy(projectName);
            return ResponseEntity.ok(roster);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/projects/{projectName}")
    public ResponseEntity<?> deleteProject(@PathVariable String projectName, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only Super Administrators can delete projects."));
        }
        try {
            hierarchyService.deleteProject(projectName);
            return ResponseEntity.ok(Map.of("message", "Project and its team hierarchy deleted successfully."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/projects/{projectName}/leads/{leadRole}")
    public ResponseEntity<?> unassignProjectLead(@PathVariable String projectName, @PathVariable String leadRole, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication) && !AuthContext.hasRole(authentication, AuthContext.ROLE_PROJECT_MANAGER)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only administrators and Project Managers can unassign team leaders."));
        }
        try {
            ProjectRosterDto roster = hierarchyService.unassignProjectLead(projectName, leadRole);
            return ResponseEntity.ok(roster);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/pm")
    public ResponseEntity<?> createOrUpdatePm(@RequestBody Map<String, Object> body, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication) && !AuthContext.hasRole(authentication, AuthContext.ROLE_PROJECT_MANAGER)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only administrators can configure Project Managers."));
        }

        try {
            Long userId = body.get("userId") != null ? Long.valueOf(body.get("userId").toString()) : null;
            String email = body.get("email") != null ? body.get("email").toString() : null;
            String name = body.get("name") != null ? body.get("name").toString() : null;
            String pmResponsibilities = body.get("pmResponsibilities") != null ? body.get("pmResponsibilities").toString() : null;
            @SuppressWarnings("unchecked")
            List<String> managedProjects = body.get("managedProjects") != null ? (List<String>) body.get("managedProjects") : List.of();

            TeamHierarchy saved = hierarchyService.createOrUpdateProjectManager(userId, email, name, managedProjects, pmResponsibilities);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException | NoSuchElementException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/pm/{id}")
    public ResponseEntity<?> deletePm(@PathVariable String id, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only administrators can remove Project Managers."));
        }
        hierarchyService.deleteHierarchy(id);
        return ResponseEntity.ok(Map.of("message", "Project Manager hierarchy deleted successfully."));
    }

    @PostMapping("/{pmId}/leads")
    public ResponseEntity<?> assignLead(@PathVariable String pmId, @RequestBody Map<String, Object> body, Authentication authentication) {
        if (!AuthContext.isManager(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied."));
        }

        try {
            Long leadId = body.get("leadId") != null ? Long.valueOf(body.get("leadId").toString()) : null;
            String leadEmail = body.get("leadEmail") != null ? body.get("leadEmail").toString() : null;
            String leadName = body.get("leadName") != null ? body.get("leadName").toString() : null;
            String leadRole = body.get("leadRole") != null ? body.get("leadRole").toString() : null;
            String leadTitle = body.get("leadTitle") != null ? body.get("leadTitle").toString() : null;
            String responsibilities = body.get("responsibilities") != null ? body.get("responsibilities").toString() : null;

            TeamHierarchy updated = hierarchyService.assignTeamLead(pmId, leadId, leadEmail, leadName, leadRole, leadTitle, responsibilities);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException | NoSuchElementException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{pmId}/leads/{leadEmail}")
    public ResponseEntity<?> removeLead(@PathVariable String pmId, @PathVariable String leadEmail, Authentication authentication) {
        if (!AuthContext.isManager(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied."));
        }
        TeamHierarchy updated = hierarchyService.removeTeamLead(pmId, leadEmail);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{pmId}/leads/{leadEmail}/members")
    public ResponseEntity<?> mapMember(@PathVariable String pmId,
                                       @PathVariable String leadEmail,
                                       @RequestBody Map<String, Object> body,
                                       Authentication authentication) {
        if (!AuthContext.isManager(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied."));
        }

        try {
            Long memberId = body.get("memberId") != null ? Long.valueOf(body.get("memberId").toString()) : null;
            String memberEmail = body.get("memberEmail") != null ? body.get("memberEmail").toString() : null;
            String memberName = body.get("memberName") != null ? body.get("memberName").toString() : null;
            String memberRole = body.get("memberRole") != null ? body.get("memberRole").toString() : null;
            String responsibilities = body.get("responsibilities") != null ? body.get("responsibilities").toString() : null;

            List<ProjectAssignment> projectAssignments = new java.util.ArrayList<>();
            if (body.get("projectAssignments") instanceof List) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> list = (List<Map<String, Object>>) body.get("projectAssignments");
                for (Map<String, Object> m : list) {
                    if (m.get("projectName") != null) {
                        String proj = m.get("projectName").toString();
                        String prio = m.get("priority") != null ? m.get("priority").toString() : "MEDIUM";
                        Integer alloc = m.get("allocation") != null ? Integer.valueOf(m.get("allocation").toString()) : null;
                        String notes = m.get("notes") != null ? m.get("notes").toString() : null;
                        String resp = m.get("responsibilities") != null ? m.get("responsibilities").toString() : notes;
                        projectAssignments.add(new ProjectAssignment(proj, prio, alloc, notes, resp));
                    }
                }
            }

            TeamHierarchy updated = hierarchyService.mapMember(pmId, leadEmail, memberId, memberEmail, memberName, memberRole, responsibilities, projectAssignments);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException | NoSuchElementException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{pmId}/leads/{leadEmail}/members/{memberEmail}")
    public ResponseEntity<?> removeMember(@PathVariable String pmId,
                                          @PathVariable String leadEmail,
                                          @PathVariable String memberEmail,
                                          Authentication authentication) {
        if (!AuthContext.isManager(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied."));
        }
        TeamHierarchy updated = hierarchyService.removeMember(pmId, leadEmail, memberEmail);
        return ResponseEntity.ok(updated);
    }
}
