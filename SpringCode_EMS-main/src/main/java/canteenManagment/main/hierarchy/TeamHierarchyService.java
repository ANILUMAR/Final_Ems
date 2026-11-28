package canteenManagment.main.hierarchy;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import canteenManagment.main.UserEntity.MasterProjectTbl;
import canteenManagment.main.UserEntity.Project;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.security.Roles;
import canteenManagment.main.service.ProjectService;
import canteenManagment.main.userReposerity.MasterProjectRepository;
import canteenManagment.main.userReposerity.ProjectRepository;
import canteenManagment.main.userReposerity.UserRepository;

@Service
public class TeamHierarchyService {

    @Autowired
    private TeamHierarchyRepository hierarchyRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MasterProjectRepository projectRepository;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private ProjectRepository projectRepo;

    @Autowired
    private ProjectHierarchyApprovalRepository approvalRepository;

    public List<TeamHierarchy> getAll() {
        ensureDefaultHierarchy();
        return hierarchyRepository.findAll();
    }

    public TeamHierarchy getById(String id) {
        return hierarchyRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Hierarchy not found with id: " + id));
    }

    public TeamHierarchy createOrUpdateProjectManager(Long userId, String email, String name, List<String> managedProjects) {
        return createOrUpdateProjectManager(userId, email, name, managedProjects, null);
    }

    public TeamHierarchy createOrUpdateProjectManager(Long userId, String email, String name, List<String> managedProjects, String pmResponsibilities) {
        if ((userId == null && (email == null || email.trim().isEmpty()))) {
            throw new IllegalArgumentException("User identifier is required.");
        }

        UserEntity user;
        if (userId != null) {
            user = userRepository.findById(userId).orElse(null);
        } else {
            user = userRepository.findByEmailIgnoreCase(email.trim()).orElse(null);
        }

        if (user == null) {
            throw new NoSuchElementException("Employee not found for Project Manager role.");
        }

        // Promote to PROJECT_MANAGER if not already SUPER_ADMIN
        if (!Roles.isSuperAdmin(user.getRole())) {
            user.setRole(Roles.PROJECT_MANAGER);
            userRepository.save(user);
        }

        String userEmail = user.getEmail().toLowerCase(Locale.ROOT);
        String userName = user.getName() != null && !user.getName().trim().isEmpty() ? user.getName().trim() : user.getEmail();

        TeamHierarchy hierarchy = hierarchyRepository.findByProjectManagerEmailIgnoreCase(userEmail)
                .orElseGet(() -> {
                    TeamHierarchy h = new TeamHierarchy();
                    h.setId(UUID.randomUUID().toString());
                    h.setCreatedAt(new Date());
                    h.setTeamLeads(new ArrayList<>());
                    return h;
                });

        hierarchy.setProjectManagerId(user.getId());
        hierarchy.setProjectManagerEmail(userEmail);
        hierarchy.setProjectManagerName(userName);
        if (pmResponsibilities != null) {
            hierarchy.setPmResponsibilities(pmResponsibilities.trim());
        }

        List<String> current = hierarchy.getManagedProjects() != null ? new ArrayList<>(hierarchy.getManagedProjects()) : new ArrayList<>();
        if (managedProjects != null) {
            for (String p : managedProjects) {
                if (p != null && !p.trim().isEmpty() && !current.contains(p.trim())) {
                    current.add(p.trim());
                }
            }
        }
        hierarchy.setManagedProjects(current);
        hierarchy.setUpdatedAt(new Date());

        return hierarchyRepository.save(hierarchy);
    }

    public TeamHierarchy assignTeamLead(String hierarchyId, Long leadId, String leadEmail, String leadName, String leadRole, String leadTitle) {
        return assignTeamLead(hierarchyId, leadId, leadEmail, leadName, leadRole, leadTitle, null);
    }

    public TeamHierarchy assignTeamLead(String hierarchyId, Long leadId, String leadEmail, String leadName, String leadRole, String leadTitle, String responsibilities) {
        TeamHierarchy hierarchy = getById(hierarchyId);

        if (leadEmail == null || leadEmail.trim().isEmpty()) {
            throw new IllegalArgumentException("Lead email is required.");
        }

        String normalizedEmail = leadEmail.trim().toLowerCase(Locale.ROOT);
        UserEntity user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new NoSuchElementException("Team leader not found with email: " + leadEmail));

        // Lead role resolution
        String role = leadRole != null && !leadRole.trim().isEmpty()
                ? leadRole.trim().toUpperCase(Locale.ROOT)
                : user.getRole();

        String title = leadTitle != null && !leadTitle.trim().isEmpty()
                ? leadTitle.trim()
                : (Roles.isTesterLead(role) ? "Testing Lead" : "Java Lead");

        // Check if lead already exists under this PM
        LeadNode existingLead = hierarchy.getTeamLeads().stream()
                .filter(l -> l.getLeadEmail().equalsIgnoreCase(normalizedEmail))
                .findFirst()
                .orElse(null);

        if (existingLead != null) {
            existingLead.setLeadName(user.getName() != null ? user.getName() : user.getEmail());
            existingLead.setLeadRole(role);
            existingLead.setLeadTitle(title);
            if (responsibilities != null) {
                existingLead.setResponsibilities(responsibilities.trim());
            }
        } else {
            LeadNode newLead = new LeadNode(user.getId(), user.getName() != null ? user.getName() : user.getEmail(), normalizedEmail, role, title, responsibilities);
            hierarchy.getTeamLeads().add(newLead);
        }

        hierarchy.setUpdatedAt(new Date());
        return hierarchyRepository.save(hierarchy);
    }

    public TeamHierarchy removeTeamLead(String hierarchyId, String leadEmail) {
        TeamHierarchy hierarchy = getById(hierarchyId);
        if (leadEmail != null) {
            hierarchy.getTeamLeads().removeIf(l -> l.getLeadEmail().equalsIgnoreCase(leadEmail.trim()));
            hierarchy.setUpdatedAt(new Date());
            return hierarchyRepository.save(hierarchy);
        }
        return hierarchy;
    }

    public TeamHierarchy mapMember(String hierarchyId, String leadEmail, Long memberId, String memberEmail,
                                   String memberName, String memberRole, List<ProjectAssignment> projectAssignments) {
        return mapMember(hierarchyId, leadEmail, memberId, memberEmail, memberName, memberRole, null, projectAssignments);
    }

    public TeamHierarchy mapMember(String hierarchyId, String leadEmail, Long memberId, String memberEmail,
                                   String memberName, String memberRole, String responsibilities, List<ProjectAssignment> projectAssignments) {
        TeamHierarchy hierarchy = getById(hierarchyId);

        LeadNode targetLead = hierarchy.getTeamLeads().stream()
                .filter(l -> l.getLeadEmail().equalsIgnoreCase(leadEmail.trim()))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Lead " + leadEmail + " not found under this Project Manager."));

        String normalizedEmail = memberEmail.trim().toLowerCase(Locale.ROOT);
        UserEntity member = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new NoSuchElementException("Team member not found with email: " + memberEmail));

        String role = memberRole != null && !memberRole.trim().isEmpty()
                ? memberRole.trim().toUpperCase(Locale.ROOT)
                : member.getRole();

        // Enforce role compatibility: Java Lead takes developers, Testing Lead takes testers
        if (Roles.isTesterLead(targetLead.getLeadRole()) && !Roles.FAMILY_TESTER.equals(Roles.family(role))) {
            throw new IllegalArgumentException("A Testing Lead can only have Testers mapped under them.");
        }
        if (Roles.isDeveloperLead(targetLead.getLeadRole()) && !Roles.FAMILY_DEVELOPER.equals(Roles.family(role))) {
            throw new IllegalArgumentException("A Java / Developer Lead can only have Developers mapped under them.");
        }

        // Sanitize project assignments
        List<ProjectAssignment> cleanAssignments = new ArrayList<>();
        if (projectAssignments != null) {
            for (ProjectAssignment pa : projectAssignments) {
                if (pa != null && pa.getProjectName() != null && !pa.getProjectName().trim().isEmpty()) {
                    String prio = pa.getPriority() != null && !pa.getPriority().trim().isEmpty() ? pa.getPriority().trim().toUpperCase(Locale.ROOT) : "MEDIUM";
                    String resp = pa.getResponsibilities() != null && !pa.getResponsibilities().trim().isEmpty() ? pa.getResponsibilities().trim() : pa.getNotes();
                    cleanAssignments.add(new ProjectAssignment(pa.getProjectName().trim(), prio, pa.getAllocation(), resp, resp));
                }
            }
        }

        MemberNode existingMember = targetLead.getMembers().stream()
                .filter(m -> m.getMemberEmail().equalsIgnoreCase(normalizedEmail))
                .findFirst()
                .orElse(null);

        if (existingMember != null) {
            existingMember.setMemberName(member.getName() != null ? member.getName() : member.getEmail());
            existingMember.setMemberRole(role);
            if (responsibilities != null) {
                existingMember.setResponsibilities(responsibilities.trim());
            }
            existingMember.setProjectAssignments(cleanAssignments);
        } else {
            MemberNode newMember = new MemberNode(member.getId(), member.getName() != null ? member.getName() : member.getEmail(), normalizedEmail, role, responsibilities);
            newMember.setProjectAssignments(cleanAssignments);
            targetLead.getMembers().add(newMember);
        }

        hierarchy.setUpdatedAt(new Date());
        return hierarchyRepository.save(hierarchy);
    }

    public TeamHierarchy removeMember(String hierarchyId, String leadEmail, String memberEmail) {
        TeamHierarchy hierarchy = getById(hierarchyId);
        LeadNode targetLead = hierarchy.getTeamLeads().stream()
                .filter(l -> l.getLeadEmail().equalsIgnoreCase(leadEmail.trim()))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Lead not found: " + leadEmail));

        targetLead.getMembers().removeIf(m -> m.getMemberEmail().equalsIgnoreCase(memberEmail.trim()));
        hierarchy.setUpdatedAt(new Date());
        return hierarchyRepository.save(hierarchy);
    }

    public void deleteHierarchy(String hierarchyId) {
        hierarchyRepository.deleteById(hierarchyId);
    }

    /**
     * Resolves reporting lead for an employee based on hierarchy mapping.
     */
    public Optional<LeadNode> findReportingLeadForEmployee(String employeeEmail) {
        if (employeeEmail == null || employeeEmail.trim().isEmpty()) {
            return Optional.empty();
        }
        String email = employeeEmail.trim().toLowerCase(Locale.ROOT);

        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            for (LeadNode lead : h.getTeamLeads()) {
                boolean isMember = lead.getMembers().stream().anyMatch(m -> m.getMemberEmail().equalsIgnoreCase(email));
                if (isMember) {
                    return Optional.of(lead);
                }
            }
        }
        return Optional.empty();
    }

    /**
     * Resolves Project Manager for a Team Lead based on hierarchy mapping.
     */
    public Optional<TeamHierarchy> findProjectManagerForLead(String leadEmail) {
        if (leadEmail == null || leadEmail.trim().isEmpty()) {
            return Optional.empty();
        }
        String email = leadEmail.trim().toLowerCase(Locale.ROOT);

        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            boolean hasLead = h.getTeamLeads().stream().anyMatch(l -> l.getLeadEmail().equalsIgnoreCase(email));
            if (hasLead) {
                return Optional.of(h);
            }
        }
        return Optional.empty();
    }

    /**
     * Retrieves all assigned projects and their priorities for a given member.
     */
    public List<ProjectAssignment> getAssignedProjectsForMember(String memberEmail) {
        if (memberEmail == null || memberEmail.trim().isEmpty()) {
            return Collections.emptyList();
        }
        String email = memberEmail.trim().toLowerCase(Locale.ROOT);
        List<ProjectAssignment> assignments = new ArrayList<>();

        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            for (LeadNode lead : h.getTeamLeads()) {
                for (MemberNode m : lead.getMembers()) {
                    if (m.getMemberEmail().equalsIgnoreCase(email) && m.getProjectAssignments() != null) {
                        assignments.addAll(m.getProjectAssignments());
                    }
                }
            }
        }
        return assignments;
    }

    /**
     * Formats role into a human-friendly display label.
     */
    private String formatRoleLabel(String role) {
        if (role == null) return "Developer";
        String r = role.trim().toUpperCase(Locale.ROOT);
        switch (r) {
            case Roles.SUPER_ADMIN:
            case Roles.LEGACY_ADMIN:
                return "Super Admin / CEO";
            case Roles.PROJECT_MANAGER:
                return "Project Manager";
            case Roles.DEVELOPER_LEAD:
                return "Java Team Leader";
            case Roles.TESTER_LEAD:
                return "Testing Team Leader";
            case Roles.TESTER:
                return "Tester";
            case Roles.EMPLOYEE:
            default:
                return "Developer";
        }
    }

    /**
     * Extracts 1-2 character initials for display avatars.
     */
    private String getInitials(String name, String email) {
        String source = (name != null && !name.trim().isEmpty()) ? name.trim() : (email != null ? email.trim() : "EM");
        String[] parts = source.split("\\s+");
        if (parts.length >= 2 && !parts[0].isEmpty() && !parts[1].isEmpty()) {
            return ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase(Locale.ROOT);
        }
        if (!source.isEmpty()) {
            return source.substring(0, Math.min(2, source.length())).toUpperCase(Locale.ROOT);
        }
        return "EM";
    }

    /**
     * Automatically establishes a baseline project and team hierarchy if none exist in the database yet.
     */
    public synchronized void ensureDefaultHierarchy() {
        if (hierarchyRepository.count() > 0) {
            return;
        }

        List<UserEntity> users = userRepository.findAll();
        if (users == null || users.isEmpty()) {
            return;
        }

        UserEntity pmUser = users.stream()
                .filter(u -> Roles.isSuperAdmin(u.getRole()))
                .findFirst()
                .orElse(users.get(0));

        UserEntity devLeadUser = users.stream()
                .filter(u -> Roles.isDeveloperLead(u.getRole()))
                .findFirst()
                .orElse(null);

        UserEntity testLeadUser = users.stream()
                .filter(u -> Roles.isTesterLead(u.getRole()))
                .findFirst()
                .orElse(null);

        String defaultProject = "Employee Management System";
        ensureProjectExists(defaultProject, "Enterprise Employee Management Suite");

        try {
            ProjectHierarchyApproval defaultApp = getOrCreateApproval(defaultProject);
            defaultApp.setStatus(ProjectHierarchyApproval.STATUS_APPROVED);
            defaultApp.setWorkAuthorized(true);
            defaultApp.setApprovedBy(pmUser.getEmail());
            defaultApp.setApprovedByName(pmUser.getName() != null ? pmUser.getName() : "Super Admin");
            defaultApp.setApprovedAt(new Date());
            approvalRepository.save(defaultApp);
        } catch (Exception ignored) {}

        TeamHierarchy hierarchy = new TeamHierarchy(
                UUID.randomUUID().toString(),
                pmUser.getId(),
                pmUser.getName() != null && !pmUser.getName().trim().isEmpty() ? pmUser.getName() : pmUser.getEmail(),
                pmUser.getEmail()
        );
        hierarchy.setManagedProjects(new ArrayList<>(List.of(defaultProject)));
        hierarchy.setPmResponsibilities("Oversee end-to-end delivery of Employee Management Suite, sprint goals, and client milestones");

        if (devLeadUser != null) {
            LeadNode devLead = new LeadNode(
                    devLeadUser.getId(),
                    devLeadUser.getName() != null && !devLeadUser.getName().trim().isEmpty() ? devLeadUser.getName() : devLeadUser.getEmail(),
                    devLeadUser.getEmail(),
                    Roles.DEVELOPER_LEAD,
                    "Java Team Leader",
                    "Backend architecture, Spring Boot microservices, REST APIs, and code reviews"
            );
            devLead.getAssignedProjects().add(defaultProject);

            for (UserEntity u : users) {
                if (Roles.EMPLOYEE.equalsIgnoreCase(u.getRole()) && !u.getEmail().equalsIgnoreCase(devLeadUser.getEmail())) {
                    MemberNode m = new MemberNode(
                            u.getId(),
                            u.getName() != null && !u.getName().trim().isEmpty() ? u.getName() : u.getEmail(),
                            u.getEmail(),
                            Roles.EMPLOYEE,
                            "Feature development, backend API endpoints, and unit testing"
                    );
                    m.getProjectAssignments().add(new ProjectAssignment(defaultProject, "HIGH", 100, "Backend features & API development", "Sprint focus"));
                    devLead.getMembers().add(m);
                }
            }
            hierarchy.getTeamLeads().add(devLead);
        }

        if (testLeadUser != null) {
            LeadNode testLead = new LeadNode(
                    testLeadUser.getId(),
                    testLeadUser.getName() != null && !testLeadUser.getName().trim().isEmpty() ? testLeadUser.getName() : testLeadUser.getEmail(),
                    testLeadUser.getEmail(),
                    Roles.TESTER_LEAD,
                    "Testing Team Leader",
                    "Test strategy, QA automation pipelines, regression sign-off, and defect verification"
            );
            testLead.getAssignedProjects().add(defaultProject);

            for (UserEntity u : users) {
                if (Roles.TESTER.equalsIgnoreCase(u.getRole()) && !u.getEmail().equalsIgnoreCase(testLeadUser.getEmail())) {
                    MemberNode m = new MemberNode(
                            u.getId(),
                            u.getName() != null && !u.getName().trim().isEmpty() ? u.getName() : u.getEmail(),
                            u.getEmail(),
                            Roles.TESTER,
                            "Manual, automated, and regression testing"
                    );
                    m.getProjectAssignments().add(new ProjectAssignment(defaultProject, "HIGH", 100, "Functional test scenarios and bug verification", "Sprint focus"));
                    testLead.getMembers().add(m);
                }
            }
            hierarchy.getTeamLeads().add(testLead);
        }

        hierarchyRepository.save(hierarchy);
    }

    /**
     * Categorizes active candidates by role and project options for pickers.
     */
    public Map<String, Object> getCandidates() {
        ensureDefaultHierarchy();

        List<UserEntity> allUsers = userRepository.findAll().stream()
                .filter(u -> !Boolean.FALSE.equals(u.getActive()))
                .collect(Collectors.toList());

        List<Map<String, Object>> allEmployees = new ArrayList<>();
        List<Map<String, Object>> pmCandidates = new ArrayList<>();
        List<Map<String, Object>> devLeads = new ArrayList<>();
        List<Map<String, Object>> testerLeads = new ArrayList<>();
        List<Map<String, Object>> developers = new ArrayList<>();
        List<Map<String, Object>> testers = new ArrayList<>();

        for (UserEntity u : allUsers) {
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("id", u.getId());
            dto.put("name", u.getName() != null && !u.getName().trim().isEmpty() ? u.getName().trim() : u.getEmail());
            dto.put("email", u.getEmail());
            dto.put("role", u.getRole() != null ? u.getRole() : Roles.EMPLOYEE);
            dto.put("roleLabel", formatRoleLabel(u.getRole()));
            dto.put("initials", getInitials(u.getName(), u.getEmail()));
            dto.put("phoneNumber", u.getPhoneNumber() != null ? u.getPhoneNumber() : "");

            allEmployees.add(dto);

            String rawRole = Roles.raw(u.getRole());

            // 1. Any active user in the system can be designated as a Project Manager
            pmCandidates.add(dto);

            // 2. Any developer, lead, or admin can be designated as Java Team Leader
            if (Roles.isDeveloperLead(rawRole) || Roles.EMPLOYEE.equalsIgnoreCase(rawRole) || Roles.FAMILY_DEVELOPER.equals(Roles.family(rawRole)) || Roles.isSuperAdmin(rawRole)) {
                devLeads.add(dto);
            }

            // 3. Any tester, lead, or admin can be designated as Testing Team Leader
            if (Roles.isTesterLead(rawRole) || Roles.TESTER.equalsIgnoreCase(rawRole) || Roles.FAMILY_TESTER.equals(Roles.family(rawRole)) || Roles.isSuperAdmin(rawRole)) {
                testerLeads.add(dto);
            }

            // 4. Developers
            if (Roles.EMPLOYEE.equalsIgnoreCase(rawRole) || Roles.FAMILY_DEVELOPER.equals(Roles.family(rawRole)) || Roles.isDeveloperLead(rawRole)) {
                developers.add(dto);
            }

            // 5. Testers
            if (Roles.TESTER.equalsIgnoreCase(rawRole) || Roles.FAMILY_TESTER.equals(Roles.family(rawRole)) || Roles.isTesterLead(rawRole)) {
                testers.add(dto);
            }
        }

        allEmployees.sort(Comparator.comparing(m -> String.valueOf(m.get("name")), String.CASE_INSENSITIVE_ORDER));

        // Aggregate projects from both tables and active hierarchies
        Set<String> projectSet = new LinkedHashSet<>();
        try {
            for (Project p : projectRepo.findAll()) {
                if (p.getName() != null && !p.getName().trim().isEmpty()) {
                    projectSet.add(p.getName().trim());
                }
            }
        } catch (Exception ignored) {}

        try {
            for (MasterProjectTbl mp : projectRepository.findAll()) {
                if (mp.getProjectName() != null && !mp.getProjectName().trim().isEmpty()) {
                    projectSet.add(mp.getProjectName().trim());
                }
            }
        } catch (Exception ignored) {}

        try {
            for (TeamHierarchy h : hierarchyRepository.findAll()) {
                if (h.getManagedProjects() != null) {
                    for (String p : h.getManagedProjects()) {
                        if (p != null && !p.trim().isEmpty()) {
                            projectSet.add(p.trim());
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        // Ensure baseline project if system has no projects yet
        if (projectSet.isEmpty()) {
            ensureProjectExists("EMS", "Employee Management Suite");
            projectSet.add("EMS");
        }

        List<String> projects = new ArrayList<>(projectSet);
        Collections.sort(projects);

        Map<String, Object> response = new HashMap<>();
        response.put("allEmployees", allEmployees);
        response.put("pmCandidates", pmCandidates);
        response.put("devLeads", devLeads);
        response.put("testerLeads", testerLeads);
        response.put("developers", developers);
        response.put("testers", testers);
        response.put("projects", projects);

        return response;
    }

    /**
     * Creates a project directly from the hierarchy management screen.
     */
    public Project createProjectFromHierarchy(String name, String description) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Project name is required.");
        }
        String cleanName = name.trim();
        Project project = new Project();
        project.setName(cleanName);
        project.setDescription(description != null ? description.trim() : "");
        return projectService.create(project);
    }

    public void ensureProjectExists(String name, String description) {
        if (name == null || name.trim().isEmpty()) {
            return;
        }
        String cleanName = name.trim();
        boolean existsInMaster = projectRepository.findFirstByProjectNameIgnoreCase(cleanName).isPresent();
        if (!existsInMaster) {
            MasterProjectTbl master = new MasterProjectTbl();
            master.setProjectName(cleanName);
            master.setIsActive(true);
            projectRepository.save(master);
        }
        boolean existsInProject = projectRepo.findFirstByNameIgnoreCase(cleanName).isPresent();
        if (!existsInProject) {
            Project p = new Project();
            p.setName(cleanName);
            p.setDescription(description != null ? description.trim() : "");
            projectRepo.save(p);
        }
    }

    /**
     * Builds and aggregates project rosters across all configured hierarchies and registered projects.
     */
    public List<ProjectRosterDto> getProjectRosters() {
        ensureDefaultHierarchy();
        Map<String, String> projectDescriptions = new LinkedHashMap<>();

        // 1. Projects from main project table
        for (Project p : projectRepo.findAll()) {
            if (p.getName() != null && !p.getName().trim().isEmpty()) {
                projectDescriptions.put(p.getName().trim(), p.getDescription() != null ? p.getDescription() : "");
            }
        }

        // 2. Projects from master project table
        for (MasterProjectTbl mp : projectRepository.findAll()) {
            if (mp.getProjectName() != null && !mp.getProjectName().trim().isEmpty()) {
                projectDescriptions.putIfAbsent(mp.getProjectName().trim(), "");
            }
        }

        // 3. Projects mentioned in hierarchies
        List<TeamHierarchy> allHierarchies = hierarchyRepository.findAll();
        for (TeamHierarchy h : allHierarchies) {
            if (h.getManagedProjects() != null) {
                for (String p : h.getManagedProjects()) {
                    if (p != null && !p.trim().isEmpty()) {
                        projectDescriptions.putIfAbsent(p.trim(), "");
                    }
                }
            }
        }

        if (projectDescriptions.isEmpty()) {
            ensureProjectExists("EMS", "Employee Management Suite");
            projectDescriptions.put("EMS", "Employee Management Suite");
        }

        List<ProjectRosterDto> rosters = new ArrayList<>();
        for (Map.Entry<String, String> entry : projectDescriptions.entrySet()) {
            rosters.add(buildRosterForProject(entry.getKey(), entry.getValue(), allHierarchies));
        }

        return rosters;
    }

    public List<ProjectRosterDto> getAssignedProjectsForUser(String userEmail, boolean isSuperAdmin) {
        List<ProjectRosterDto> allRosters = getProjectRosters();
        if (userEmail == null || userEmail.trim().isEmpty()) {
            return isSuperAdmin ? allRosters : Collections.emptyList();
        }

        String targetEmail = userEmail.trim().toLowerCase();
        List<ProjectRosterDto> userRosters = new ArrayList<>();

        for (ProjectRosterDto roster : allRosters) {
            boolean matches = false;
            String role = null;
            String resp = null;
            Integer alloc = 100;
            String prio = "HIGH";

            if (roster.getPmEmail() != null && roster.getPmEmail().trim().equalsIgnoreCase(targetEmail)) {
                matches = true;
                role = "Project Manager";
                resp = roster.getPmResponsibilities();
                alloc = 100;
                prio = "HIGH";
            } else if (roster.getDevLeadEmail() != null && roster.getDevLeadEmail().trim().equalsIgnoreCase(targetEmail)) {
                matches = true;
                role = "Java Team Leader";
                resp = roster.getDevLeadResponsibilities();
                alloc = 100;
                prio = "HIGH";
            } else if (roster.getTesterLeadEmail() != null && roster.getTesterLeadEmail().trim().equalsIgnoreCase(targetEmail)) {
                matches = true;
                role = "Testing Team Leader";
                resp = roster.getTesterLeadResponsibilities();
                alloc = 100;
                prio = "HIGH";
            } else if (roster.getMembers() != null) {
                for (ProjectRosterDto.ProjectMemberDto m : roster.getMembers()) {
                    if (m.getMemberEmail() != null && m.getMemberEmail().trim().equalsIgnoreCase(targetEmail)) {
                        matches = true;
                        role = m.getMemberRole();
                        resp = m.getResponsibilities();
                        alloc = m.getAllocation() != null ? m.getAllocation() : 100;
                        prio = m.getPriority() != null ? m.getPriority() : "MEDIUM";
                        break;
                    }
                }
            }

            if (matches) {
                roster.setMyRoleOnProject(role);
                roster.setMyResponsibilities(resp != null ? resp : "");
                roster.setMyAllocation(alloc);
                roster.setMyPriority(prio);
                userRosters.add(roster);
            } else if (isSuperAdmin) {
                roster.setMyRoleOnProject("Super Admin / CEO");
                roster.setMyResponsibilities("Executive oversight, project governance, and work authorization");
                roster.setMyAllocation(100);
                roster.setMyPriority("HIGH");
                userRosters.add(roster);
            }
        }

        return userRosters;
    }

    public static boolean projectMatches(String p1, String p2) {
        if (p1 == null || p2 == null) return false;
        String s1 = p1.trim();
        String s2 = p2.trim();
        if (s1.equalsIgnoreCase(s2)) return true;
        String n1 = s1.replaceAll("[\\s_\\-]+", "").toLowerCase(Locale.ROOT);
        String n2 = s2.replaceAll("[\\s_\\-]+", "").toLowerCase(Locale.ROOT);
        if (n1.equals(n2)) return true;
        return n1.length() >= 5 && n2.length() >= 5 && (n1.contains(n2) || n2.contains(n1));
    }

    public ProjectRosterDto buildRosterForProject(String projectName) {
        String description = projectRepo.findFirstByNameIgnoreCase(projectName)
                .map(Project::getDescription)
                .orElse("");
        return buildRosterForProject(projectName, description, hierarchyRepository.findAll());
    }

    public ProjectRosterDto buildRosterForProject(String projectName, String description, List<TeamHierarchy> allHierarchies) {
        ProjectRosterDto roster = new ProjectRosterDto(projectName, description);
        List<ProjectRosterDto.ProjectMemberDto> rosterMembers = new ArrayList<>();

        for (TeamHierarchy h : allHierarchies) {
            boolean managesThis = h.getManagedProjects() != null &&
                    h.getManagedProjects().stream().anyMatch(p -> projectMatches(p, projectName));

            // If this hierarchy manages this project, record the PM
            if (managesThis && roster.getPmEmail() == null) {
                Long pmId = h.getProjectManagerId();
                if (pmId == null && h.getProjectManagerEmail() != null) {
                    pmId = userRepository.findByEmailIgnoreCase(h.getProjectManagerEmail()).map(UserEntity::getId).orElse(null);
                }
                roster.setPmId(pmId);
                roster.setPmName(h.getProjectManagerName());
                roster.setPmEmail(h.getProjectManagerEmail());
                String pmResp = (h.getProjectResponsibilities() != null && h.getProjectResponsibilities().containsKey(projectName))
                        ? h.getProjectResponsibilities().get(projectName)
                        : h.getPmResponsibilities();
                roster.setPmResponsibilities(pmResp != null ? pmResp : "");
            }

            for (LeadNode lead : h.getTeamLeads()) {
                Long leadId = lead.getLeadId();
                if (leadId == null && lead.getLeadEmail() != null) {
                    leadId = userRepository.findByEmailIgnoreCase(lead.getLeadEmail()).map(UserEntity::getId).orElse(null);
                }

                boolean explicitlyAssigned = lead.getAssignedProjects() != null &&
                        lead.getAssignedProjects().stream().anyMatch(p -> projectMatches(p, projectName));

                if (Roles.isDeveloperLead(lead.getLeadRole()) && explicitlyAssigned && roster.getDevLeadEmail() == null) {
                    roster.setDevLeadId(leadId);
                    roster.setDevLeadName(lead.getLeadName());
                    roster.setDevLeadEmail(lead.getLeadEmail());
                    roster.setDevLeadTitle(lead.getLeadTitle());
                    roster.setDevLeadProductionSupport(Boolean.TRUE.equals(lead.getProjectProductionSupport().get(projectName)));
                    String devResp = (lead.getProjectResponsibilities() != null && lead.getProjectResponsibilities().containsKey(projectName))
                            ? lead.getProjectResponsibilities().get(projectName)
                            : lead.getResponsibilities();
                    roster.setDevLeadResponsibilities(devResp != null ? devResp : "");
                } else if (Roles.isTesterLead(lead.getLeadRole()) && explicitlyAssigned && roster.getTesterLeadEmail() == null) {
                    roster.setTesterLeadId(leadId);
                    roster.setTesterLeadName(lead.getLeadName());
                    roster.setTesterLeadEmail(lead.getLeadEmail());
                    roster.setTesterLeadTitle(lead.getLeadTitle());
                    roster.setTesterLeadProductionSupport(Boolean.TRUE.equals(lead.getProjectProductionSupport().get(projectName)));
                    String testResp = (lead.getProjectResponsibilities() != null && lead.getProjectResponsibilities().containsKey(projectName))
                            ? lead.getProjectResponsibilities().get(projectName)
                            : lead.getResponsibilities();
                    roster.setTesterLeadResponsibilities(testResp != null ? testResp : "");
                }

                // Check members who have a project assignment for this project
                for (MemberNode m : lead.getMembers()) {
                    if (m.getProjectAssignments() != null) {
                        for (ProjectAssignment pa : m.getProjectAssignments()) {
                            if (pa != null && pa.getProjectName() != null && projectMatches(pa.getProjectName(), projectName)) {
                                boolean alreadyAdded = rosterMembers.stream().anyMatch(rm -> rm.getMemberEmail().equalsIgnoreCase(m.getMemberEmail()));
                                if (!alreadyAdded) {
                                    ProjectRosterDto.ProjectMemberDto dto = new ProjectRosterDto.ProjectMemberDto();
                                    Long mId = m.getMemberId();
                                    if (mId == null && m.getMemberEmail() != null) {
                                        mId = userRepository.findByEmailIgnoreCase(m.getMemberEmail()).map(UserEntity::getId).orElse(null);
                                    }
                                    dto.setMemberId(mId);
                                    dto.setMemberName(m.getMemberName());
                                    dto.setMemberEmail(m.getMemberEmail());
                                    dto.setMemberRole(m.getMemberRole());
                                    dto.setResponsibilities(pa.getResponsibilities() != null && !pa.getResponsibilities().trim().isEmpty() ? pa.getResponsibilities() : m.getResponsibilities());
                                    dto.setPriority(pa.getPriority() != null ? pa.getPriority() : "MEDIUM");
                                    dto.setAllocation(pa.getAllocation() != null ? pa.getAllocation() : 100);
                                    dto.setNotes(pa.getNotes());
                                    dto.setProductionSupport(Boolean.TRUE.equals(pa.getProductionSupport()));
                                    dto.setReportingLeadEmail(lead.getLeadEmail());
                                    dto.setReportingLeadName(lead.getLeadName());
                                    dto.setReportingLeadTitle(lead.getLeadTitle());
                                    rosterMembers.add(dto);
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        roster.setMembers(rosterMembers);

        // Populate approval and authorization status
        ProjectHierarchyApproval approval = getOrCreateApproval(projectName);
        if (approval != null) {
            roster.setApprovalStatus(approval.getStatus());
            roster.setSubmittedBy(approval.getSubmittedBy());
            roster.setSubmittedByName(approval.getSubmittedByName());
            roster.setSubmittedAt(approval.getSubmittedAt());
            roster.setSubmissionNotes(approval.getSubmissionNotes());
            roster.setApprovedBy(approval.getApprovedBy());
            roster.setApprovedByName(approval.getApprovedByName());
            roster.setApprovedAt(approval.getApprovedAt());
            roster.setRejectionRemarks(approval.getRejectionRemarks());
            roster.setWorkAuthorized(approval.isWorkAuthorized());
        }

        return roster;
    }

    public Set<String> getAssignedProjectNamesForUser(String userEmail) {
        if (userEmail == null || userEmail.trim().isEmpty()) {
            return Collections.emptySet();
        }
        String email = userEmail.trim().toLowerCase(Locale.ROOT);
        Set<String> projectNames = new LinkedHashSet<>();

        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            if (h.getProjectManagerEmail() != null && h.getProjectManagerEmail().trim().equalsIgnoreCase(email)) {
                if (h.getManagedProjects() != null) {
                    projectNames.addAll(h.getManagedProjects());
                }
            }
            if (h.getTeamLeads() != null) {
                for (LeadNode lead : h.getTeamLeads()) {
                    if (lead.getLeadEmail() != null && lead.getLeadEmail().trim().equalsIgnoreCase(email)) {
                        if (lead.getAssignedProjects() != null) {
                            projectNames.addAll(lead.getAssignedProjects());
                        }
                    }
                    if (lead.getMembers() != null) {
                        for (MemberNode m : lead.getMembers()) {
                            if (m.getMemberEmail() != null && m.getMemberEmail().trim().equalsIgnoreCase(email)) {
                                if (m.getProjectAssignments() != null) {
                                    for (ProjectAssignment pa : m.getProjectAssignments()) {
                                        if (pa != null && pa.getProjectName() != null && !pa.getProjectName().trim().isEmpty()) {
                                            projectNames.add(pa.getProjectName().trim());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return projectNames;
    }

    public boolean isDeveloperAssignedToProject(String projectName, Long developerId, String developerEmail) {
        if (projectName == null || projectName.trim().isEmpty()) {
            return true;
        }
        ProjectRosterDto roster = buildRosterForProject(projectName);
        boolean hasConfiguredTeam = (roster.getDevLeadEmail() != null || (roster.getMembers() != null && !roster.getMembers().isEmpty()));
        if (!hasConfiguredTeam) {
            return true;
        }

        if (developerEmail != null && roster.getDevLeadEmail() != null && roster.getDevLeadEmail().trim().equalsIgnoreCase(developerEmail.trim())) {
            return true;
        }
        if (developerId != null && roster.getDevLeadId() != null && Objects.equals(roster.getDevLeadId(), developerId)) {
            return true;
        }

        if (roster.getMembers() != null) {
            for (ProjectRosterDto.ProjectMemberDto m : roster.getMembers()) {
                if (developerEmail != null && m.getMemberEmail() != null && m.getMemberEmail().trim().equalsIgnoreCase(developerEmail.trim())) {
                    return true;
                }
                if (developerId != null && m.getMemberId() != null && Objects.equals(m.getMemberId(), developerId)) {
                    return true;
                }
            }
        }
        return false;
    }

    public boolean isTesterAssignedToProject(String projectName, Long testerId, String testerEmail) {
        if (projectName == null || projectName.trim().isEmpty()) {
            return true;
        }
        ProjectRosterDto roster = buildRosterForProject(projectName);
        boolean hasConfiguredTeam = (roster.getTesterLeadEmail() != null || (roster.getMembers() != null && !roster.getMembers().isEmpty()));
        if (!hasConfiguredTeam) {
            return true;
        }

        if (testerEmail != null && roster.getTesterLeadEmail() != null && roster.getTesterLeadEmail().trim().equalsIgnoreCase(testerEmail.trim())) {
            return true;
        }
        if (testerId != null && roster.getTesterLeadId() != null && Objects.equals(roster.getTesterLeadId(), testerId)) {
            return true;
        }

        if (roster.getMembers() != null) {
            for (ProjectRosterDto.ProjectMemberDto m : roster.getMembers()) {
                if (testerEmail != null && m.getMemberEmail() != null && m.getMemberEmail().trim().equalsIgnoreCase(testerEmail.trim())) {
                    return true;
                }
                if (testerId != null && m.getMemberId() != null && Objects.equals(m.getMemberId(), testerId)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Retrieves or initializes the approval record for a given project.
     */
    public ProjectHierarchyApproval getOrCreateApproval(String projectName) {
        if (projectName == null || projectName.trim().isEmpty()) {
            return new ProjectHierarchyApproval("General", ProjectHierarchyApproval.STATUS_APPROVED);
        }
        String clean = projectName.trim();
        return approvalRepository.findByProjectNameIgnoreCase(clean)
                .orElseGet(() -> {
                    ProjectHierarchyApproval approval = new ProjectHierarchyApproval();
                    approval.setId(ProjectHierarchyApproval.normalizeId(clean));
                    approval.setProjectName(clean);
                    approval.setCreatedAt(new Date());
                    approval.setUpdatedAt(new Date());

                    // Baseline demo projects default to approved
                    if ("Employee Management System".equalsIgnoreCase(clean) || "EMS".equalsIgnoreCase(clean)) {
                        approval.setStatus(ProjectHierarchyApproval.STATUS_APPROVED);
                        approval.setWorkAuthorized(true);
                        approval.setApprovedBy("admin@ems.com");
                        approval.setApprovedByName("Super Admin / CEO");
                        approval.setApprovedAt(new Date());
                    } else {
                        approval.setStatus(ProjectHierarchyApproval.STATUS_DRAFT);
                        approval.setWorkAuthorized(false);
                    }
                    return approvalRepository.save(approval);
                });
    }

    /**
     * Submits a project's team hierarchy to the CEO/Director for review and authorization.
     */
    public ProjectHierarchyApproval submitHierarchyForApproval(String projectName, String userEmail, String notes) {
        if (projectName == null || projectName.trim().isEmpty()) {
            throw new IllegalArgumentException("Project name is required.");
        }
        String clean = projectName.trim();
        ProjectHierarchyApproval approval = getOrCreateApproval(clean);

        UserEntity user = null;
        if (userEmail != null && !userEmail.trim().isEmpty()) {
            user = userRepository.findByEmailIgnoreCase(userEmail.trim()).orElse(null);
        }

        approval.setStatus(ProjectHierarchyApproval.STATUS_SUBMITTED);
        approval.setWorkAuthorized(false);
        approval.setSubmittedBy(user != null ? user.getEmail() : (userEmail != null ? userEmail : ""));
        approval.setSubmittedByName(user != null && user.getName() != null ? user.getName() : (user != null ? user.getEmail() : "Project Manager"));
        approval.setSubmittedAt(new Date());
        if (notes != null && !notes.trim().isEmpty()) {
            approval.setSubmissionNotes(notes.trim());
        }
        approval.setRejectionRemarks(null);
        approval.setUpdatedAt(new Date());

        return approvalRepository.save(approval);
    }

    /**
     * CEO/Director approval: authorizes project work to officially begin.
     */
    public ProjectHierarchyApproval approveHierarchy(String projectName, String reviewerEmail, String remarks) {
        if (projectName == null || projectName.trim().isEmpty()) {
            throw new IllegalArgumentException("Project name is required.");
        }
        String clean = projectName.trim();
        ProjectHierarchyApproval approval = getOrCreateApproval(clean);

        UserEntity reviewer = null;
        if (reviewerEmail != null && !reviewerEmail.trim().isEmpty()) {
            reviewer = userRepository.findByEmailIgnoreCase(reviewerEmail.trim()).orElse(null);
        }

        approval.setStatus(ProjectHierarchyApproval.STATUS_APPROVED);
        approval.setWorkAuthorized(true);
        approval.setApprovedBy(reviewer != null ? reviewer.getEmail() : (reviewerEmail != null ? reviewerEmail : "admin@ems.com"));
        approval.setApprovedByName(reviewer != null && reviewer.getName() != null ? reviewer.getName() : "CEO / Director");
        approval.setApprovedAt(new Date());
        approval.setRejectionRemarks(null);
        approval.setUpdatedAt(new Date());

        return approvalRepository.save(approval);
    }

    /**
     * CEO/Director rejection: requests revisions from the Project Manager.
     */
    public ProjectHierarchyApproval rejectHierarchy(String projectName, String reviewerEmail, String remarks) {
        if (projectName == null || projectName.trim().isEmpty()) {
            throw new IllegalArgumentException("Project name is required.");
        }
        String clean = projectName.trim();
        ProjectHierarchyApproval approval = getOrCreateApproval(clean);

        UserEntity reviewer = null;
        if (reviewerEmail != null && !reviewerEmail.trim().isEmpty()) {
            reviewer = userRepository.findByEmailIgnoreCase(reviewerEmail.trim()).orElse(null);
        }

        approval.setStatus(ProjectHierarchyApproval.STATUS_REJECTED);
        approval.setWorkAuthorized(false);
        approval.setApprovedBy(reviewer != null ? reviewer.getEmail() : (reviewerEmail != null ? reviewerEmail : "admin@ems.com"));
        approval.setApprovedByName(reviewer != null && reviewer.getName() != null ? reviewer.getName() : "CEO / Director");
        approval.setRejectionRemarks(remarks != null && !remarks.trim().isEmpty() ? remarks.trim() : "Hierarchy rejected by CEO/Director. Please review assignments and resubmit.");
        approval.setUpdatedAt(new Date());

        return approvalRepository.save(approval);
    }

    /**
     * Returns true if the project team hierarchy is approved by the CEO/Director, authorizing work to begin.
     */
    public boolean isProjectWorkAuthorized(String projectName) {
        if (projectName == null || projectName.trim().isEmpty()) {
            return true;
        }
        String clean = projectName.trim();
        if ("Employee Management System".equalsIgnoreCase(clean) || "EMS".equalsIgnoreCase(clean)) {
            return true;
        }
        return approvalRepository.findByProjectNameIgnoreCase(clean)
                .map(ProjectHierarchyApproval::isWorkAuthorized)
                .orElse(false);
    }

    /**
     * Centralized project-wise assignment: maps PM, Team Leads, and members to the specified project.
     */
    public ProjectRosterDto assignProjectTeam(ProjectTeamAssignRequest req) {
        return assignProjectTeam(req, null);
    }

    public ProjectRosterDto assignProjectTeam(ProjectTeamAssignRequest req, String callerEmail) {
        if (req == null || req.getProjectName() == null || req.getProjectName().trim().isEmpty()) {
            throw new IllegalArgumentException("Project name is required.");
        }
        String projectName = req.getProjectName().trim();

        // 1. Ensure project exists
        ensureProjectExists(projectName, req.getProjectDescription());

        // 2. Identify and assign PM
        // First, clear this projectName from ALL PM hierarchies
        for (TeamHierarchy otherH : hierarchyRepository.findAll()) {
            boolean changed = false;
            if (otherH.getManagedProjects() != null && otherH.getManagedProjects().removeIf(p -> p.equalsIgnoreCase(projectName))) {
                changed = true;
            }
            if (otherH.getProjectResponsibilities() != null && otherH.getProjectResponsibilities().remove(projectName) != null) {
                changed = true;
            }
            if (changed) {
                otherH.setUpdatedAt(new Date());
                hierarchyRepository.save(otherH);
            }
        }

        TeamHierarchy hierarchy = null;
        if (req.getPmUserId() != null || (req.getPmEmail() != null && !req.getPmEmail().trim().isEmpty())) {
            UserEntity pmUser = null;
            if (req.getPmUserId() != null) {
                pmUser = userRepository.findById(req.getPmUserId()).orElse(null);
            } else {
                pmUser = userRepository.findByEmailIgnoreCase(req.getPmEmail().trim()).orElse(null);
            }
            if (pmUser != null) {
                hierarchy = createOrUpdateProjectManager(pmUser.getId(), pmUser.getEmail(), pmUser.getName(),
                        List.of(projectName), req.getPmResponsibilities());
                hierarchy.getProjectResponsibilities().put(projectName, req.getPmResponsibilities() != null ? req.getPmResponsibilities().trim() : "");
                hierarchyRepository.save(hierarchy);
            }
        }

        // If no PM assigned, pick an existing hierarchy as lead/member container ONLY (without adding projectName to managedProjects!)
        if (hierarchy == null) {
            hierarchy = hierarchyRepository.findAll().stream().findFirst().orElseGet(() -> {
                ensureDefaultHierarchy();
                return hierarchyRepository.findAll().stream().findFirst().orElse(null);
            });
        }

        // 3. Java Lead (Developer Lead)
        // First, clear this projectName from all developer leads across all hierarchies
        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            boolean changed = false;
            for (LeadNode l : h.getTeamLeads()) {
                if (Roles.isDeveloperLead(l.getLeadRole())) {
                    if (l.getAssignedProjects() != null && l.getAssignedProjects().removeIf(p -> p.equalsIgnoreCase(projectName))) {
                        changed = true;
                    }
                    if (l.getProjectResponsibilities() != null && l.getProjectResponsibilities().remove(projectName) != null) {
                        changed = true;
                    }
                }
            }
            if (changed) {
                h.setUpdatedAt(new Date());
                hierarchyRepository.save(h);
            }
        }

        LeadNode devLead = null;
        UserEntity devUser = null;
        if (req.getDevLeadEmail() != null && !req.getDevLeadEmail().trim().isEmpty()) {
            devUser = userRepository.findByEmailIgnoreCase(req.getDevLeadEmail().trim()).orElse(null);
        } else if (req.getDevLeadId() != null) {
            devUser = userRepository.findById(req.getDevLeadId()).orElse(null);
        }

        if (devUser != null) {
            String devEmail = devUser.getEmail().toLowerCase(Locale.ROOT);
            String devTitle = req.getDevLeadTitle() != null && !req.getDevLeadTitle().trim().isEmpty() ? req.getDevLeadTitle().trim() : "Java Team Leader";
            String devResp = req.getDevLeadResponsibilities() != null ? req.getDevLeadResponsibilities().trim() : "";
            devLead = hierarchy.getTeamLeads().stream()
                    .filter(l -> l.getLeadEmail().equalsIgnoreCase(devEmail))
                    .findFirst()
                    .orElse(null);
            if (devLead == null) {
                devLead = new LeadNode(devUser.getId(), devUser.getName() != null ? devUser.getName() : devUser.getEmail(),
                        devEmail, Roles.DEVELOPER_LEAD, devTitle, devResp);
                hierarchy.getTeamLeads().add(devLead);
            } else {
                devLead.setLeadRole(Roles.DEVELOPER_LEAD);
                devLead.setLeadTitle(devTitle);
            }
            devLead.getProjectResponsibilities().put(projectName, devResp);
            boolean devProd = Boolean.TRUE.equals(req.getDevLeadProductionSupport());
            devLead.getProjectProductionSupport().put(projectName, devProd);
            if (devProd) {
                devLead.setProductionSupport(true);
            }
            if (devLead.getAssignedProjects() == null) {
                devLead.setAssignedProjects(new ArrayList<>());
            }
            if (!devLead.getAssignedProjects().stream().anyMatch(p -> p.equalsIgnoreCase(projectName))) {
                devLead.getAssignedProjects().add(projectName);
            }
        }

        // 4. Testing Lead
        // First, clear this projectName from all tester leads across all hierarchies
        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            boolean changed = false;
            for (LeadNode l : h.getTeamLeads()) {
                if (Roles.isTesterLead(l.getLeadRole())) {
                    if (l.getAssignedProjects() != null && l.getAssignedProjects().removeIf(p -> p.equalsIgnoreCase(projectName))) {
                        changed = true;
                    }
                    if (l.getProjectResponsibilities() != null && l.getProjectResponsibilities().remove(projectName) != null) {
                        changed = true;
                    }
                }
            }
            if (changed) {
                h.setUpdatedAt(new Date());
                hierarchyRepository.save(h);
            }
        }

        LeadNode testLead = null;
        UserEntity testUser = null;
        if (req.getTesterLeadEmail() != null && !req.getTesterLeadEmail().trim().isEmpty()) {
            testUser = userRepository.findByEmailIgnoreCase(req.getTesterLeadEmail().trim()).orElse(null);
        } else if (req.getTesterLeadId() != null) {
            testUser = userRepository.findById(req.getTesterLeadId()).orElse(null);
        }

        if (testUser != null) {
            String testEmail = testUser.getEmail().toLowerCase(Locale.ROOT);
            String testTitle = req.getTesterLeadTitle() != null && !req.getTesterLeadTitle().trim().isEmpty() ? req.getTesterLeadTitle().trim() : "Testing Team Leader";
            String testResp = req.getTesterLeadResponsibilities() != null ? req.getTesterLeadResponsibilities().trim() : "";
            testLead = hierarchy.getTeamLeads().stream()
                    .filter(l -> l.getLeadEmail().equalsIgnoreCase(testEmail))
                    .findFirst()
                    .orElse(null);
            if (testLead == null) {
                testLead = new LeadNode(testUser.getId(), testUser.getName() != null ? testUser.getName() : testUser.getEmail(),
                        testEmail, Roles.TESTER_LEAD, testTitle, testResp);
                hierarchy.getTeamLeads().add(testLead);
            } else {
                testLead.setLeadRole(Roles.TESTER_LEAD);
                testLead.setLeadTitle(testTitle);
            }
            testLead.getProjectResponsibilities().put(projectName, testResp);
            boolean testProd = Boolean.TRUE.equals(req.getTesterLeadProductionSupport());
            testLead.getProjectProductionSupport().put(projectName, testProd);
            if (testProd) {
                testLead.setProductionSupport(true);
            }
            if (testLead.getAssignedProjects() == null) {
                testLead.setAssignedProjects(new ArrayList<>());
            }
            if (!testLead.getAssignedProjects().stream().anyMatch(p -> p.equalsIgnoreCase(projectName))) {
                testLead.getAssignedProjects().add(projectName);
            }
        }

        // 5. Members (Developers & Testers)
        Set<String> incomingEmails = new HashSet<>();
        if (req.getMembers() != null) {
            for (ProjectTeamAssignRequest.MemberAssignmentItem item : req.getMembers()) {
                if (item.getMemberEmail() != null && !item.getMemberEmail().trim().isEmpty()) {
                    incomingEmails.add(item.getMemberEmail().trim().toLowerCase(Locale.ROOT));
                } else if (item.getMemberId() != null) {
                    userRepository.findById(item.getMemberId())
                            .ifPresent(u -> incomingEmails.add(u.getEmail().toLowerCase(Locale.ROOT)));
                }
            }
        }

        // Clean up project assignment for members who were removed from this project across all hierarchies
        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            boolean changed = false;
            for (LeadNode l : h.getTeamLeads()) {
                if (l.getMembers() != null) {
                    for (MemberNode m : l.getMembers()) {
                        if (!incomingEmails.contains(m.getMemberEmail().toLowerCase(Locale.ROOT))) {
                            if (m.getProjectAssignments() != null) {
                                if (m.getProjectAssignments().removeIf(pa -> pa.getProjectName().equalsIgnoreCase(projectName))) {
                                    changed = true;
                                }
                            }
                        }
                    }
                }
            }
            if (changed) {
                h.setUpdatedAt(new Date());
                hierarchyRepository.save(h);
            }
        }

        if (req.getMembers() != null) {
            for (ProjectTeamAssignRequest.MemberAssignmentItem item : req.getMembers()) {
                UserEntity mUser = null;
                if (item.getMemberEmail() != null && !item.getMemberEmail().trim().isEmpty()) {
                    mUser = userRepository.findByEmailIgnoreCase(item.getMemberEmail().trim()).orElse(null);
                }
                if (mUser == null && item.getMemberId() != null) {
                    mUser = userRepository.findById(item.getMemberId()).orElse(null);
                }
                if (mUser == null) {
                    continue;
                }
                String mEmail = mUser.getEmail().toLowerCase(Locale.ROOT);

                String role = item.getMemberRole() != null && !item.getMemberRole().trim().isEmpty()
                        ? item.getMemberRole().trim().toUpperCase(Locale.ROOT)
                        : mUser.getRole();

                boolean isTester = Roles.FAMILY_TESTER.equals(Roles.family(role)) || Roles.TESTER.equalsIgnoreCase(role);
                LeadNode targetLead = isTester ? testLead : devLead;

                if (targetLead == null) {
                    String leadRole = isTester ? Roles.TESTER_LEAD : Roles.DEVELOPER_LEAD;
                    String leadTitle = isTester ? "Testing Team Leader" : "Java Team Leader";
                    targetLead = new LeadNode(hierarchy.getProjectManagerId(), hierarchy.getProjectManagerName(),
                            hierarchy.getProjectManagerEmail(), leadRole, leadTitle, "Lead for " + projectName);
                    hierarchy.getTeamLeads().add(targetLead);
                    if (isTester) {
                        testLead = targetLead;
                    } else {
                        devLead = targetLead;
                    }
                }

                // If member previously existed under other lead, clean up their assignment from the other lead
                LeadNode otherLead = isTester ? devLead : testLead;
                if (otherLead != null && otherLead.getMembers() != null && otherLead != targetLead) {
                    for (MemberNode om : otherLead.getMembers()) {
                        if (om.getMemberEmail().equalsIgnoreCase(mEmail) && om.getProjectAssignments() != null) {
                            om.getProjectAssignments().removeIf(pa -> pa.getProjectName().equalsIgnoreCase(projectName));
                        }
                    }
                }

                MemberNode memberNode = targetLead.getMembers().stream()
                        .filter(m -> m.getMemberEmail().equalsIgnoreCase(mEmail))
                        .findFirst()
                        .orElse(null);

                String resp = item.getResponsibilities() != null && !item.getResponsibilities().trim().isEmpty() ? item.getResponsibilities().trim() : item.getNotes();
                if (memberNode == null) {
                    memberNode = new MemberNode(mUser.getId(), mUser.getName() != null ? mUser.getName() : mUser.getEmail(),
                            mEmail, role, resp);
                    targetLead.getMembers().add(memberNode);
                } else {
                    memberNode.setMemberRole(role);
                    if (resp != null) {
                        memberNode.setResponsibilities(resp);
                    }
                }

                String prio = item.getPriority() != null && !item.getPriority().trim().isEmpty() ? item.getPriority().trim().toUpperCase(Locale.ROOT) : "MEDIUM";
                Integer alloc = item.getAllocation() != null ? item.getAllocation() : 100;
                boolean memProd = Boolean.TRUE.equals(item.getProductionSupport());
                if (memProd) {
                    memberNode.setProductionSupport(true);
                }

                ProjectAssignment existingPa = memberNode.getProjectAssignments().stream()
                        .filter(pa -> pa.getProjectName().equalsIgnoreCase(projectName))
                        .findFirst()
                        .orElse(null);

                if (existingPa != null) {
                    existingPa.setPriority(prio);
                    existingPa.setAllocation(alloc);
                    existingPa.setResponsibilities(resp);
                    existingPa.setNotes(resp);
                    existingPa.setProductionSupport(memProd);
                } else {
                    ProjectAssignment newPa = new ProjectAssignment(projectName, prio, alloc, resp, resp);
                    newPa.setProductionSupport(memProd);
                    memberNode.getProjectAssignments().add(newPa);
                }
            }
        }

        hierarchy.setUpdatedAt(new Date());
        hierarchyRepository.save(hierarchy);

        // Process approval action (SAVE_DRAFT, SUBMIT, APPROVE)
        String action = req.getApprovalAction();
        if ("SUBMIT".equalsIgnoreCase(action)) {
            submitHierarchyForApproval(projectName, callerEmail != null ? callerEmail : req.getPmEmail(), req.getNotes());
        } else if ("APPROVE".equalsIgnoreCase(action)) {
            approveHierarchy(projectName, callerEmail, req.getNotes());
        } else {
            // Default / SAVE_DRAFT: if previously REJECTED, reset to DRAFT so PM can edit freely
            ProjectHierarchyApproval app = getOrCreateApproval(projectName);
            if (ProjectHierarchyApproval.STATUS_REJECTED.equalsIgnoreCase(app.getStatus())) {
                app.setStatus(ProjectHierarchyApproval.STATUS_DRAFT);
                app.setWorkAuthorized(false);
                app.setRejectionRemarks(null);
                approvalRepository.save(app);
            }
        }

        return buildRosterForProject(projectName);
    }

    /**
     * Unassigns a specific member from a project by removing this project from their project assignments.
     */
    public ProjectRosterDto unassignProjectMember(String projectName, String memberEmail) {
        if (projectName == null || projectName.trim().isEmpty() || memberEmail == null || memberEmail.trim().isEmpty()) {
            throw new IllegalArgumentException("Project name and member email are required.");
        }
        String pName = projectName.trim();
        String mEmail = memberEmail.trim().toLowerCase(Locale.ROOT);

        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            boolean modified = false;
            for (LeadNode l : h.getTeamLeads()) {
                if (l.getMembers() != null) {
                    for (MemberNode m : l.getMembers()) {
                        if (m.getMemberEmail() != null && m.getMemberEmail().equalsIgnoreCase(mEmail)) {
                            if (m.getProjectAssignments() != null) {
                                boolean removed = m.getProjectAssignments().removeIf(pa -> pa.getProjectName().equalsIgnoreCase(pName));
                                if (removed) {
                                    modified = true;
                                }
                            }
                        }
                    }
                }
            }
            if (modified) {
                h.setUpdatedAt(new Date());
                hierarchyRepository.save(h);
            }
        }
        return buildRosterForProject(pName);
    }

    /**
     * Clears all hierarchy assignments for the specified project: removes project from PM managed projects,
     * leads assigned projects, and members project assignments.
     */
    public ProjectRosterDto clearProjectHierarchy(String projectName) {
        if (projectName == null || projectName.trim().isEmpty()) {
            throw new IllegalArgumentException("Project name is required.");
        }
        String pName = projectName.trim();

        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            boolean modified = false;
            if (h.getManagedProjects() != null) {
                boolean removed = h.getManagedProjects().removeIf(p -> p.equalsIgnoreCase(pName));
                if (removed) modified = true;
            }
            if (h.getProjectResponsibilities() != null && h.getProjectResponsibilities().remove(pName) != null) {
                modified = true;
            }
            for (LeadNode l : h.getTeamLeads()) {
                if (l.getAssignedProjects() != null) {
                    boolean removed = l.getAssignedProjects().removeIf(p -> p.equalsIgnoreCase(pName));
                    if (removed) modified = true;
                }
                if (l.getProjectResponsibilities() != null && l.getProjectResponsibilities().remove(pName) != null) {
                    modified = true;
                }
                if (l.getMembers() != null) {
                    for (MemberNode m : l.getMembers()) {
                        if (m.getProjectAssignments() != null) {
                            boolean removed = m.getProjectAssignments().removeIf(pa -> pa.getProjectName().equalsIgnoreCase(pName));
                            if (removed) modified = true;
                        }
                    }
                }
            }
            if (modified) {
                h.setUpdatedAt(new Date());
                hierarchyRepository.save(h);
            }
        }
        // Reset approval status on clearing hierarchy
        try {
            ProjectHierarchyApproval app = getOrCreateApproval(pName);
            app.setStatus(ProjectHierarchyApproval.STATUS_DRAFT);
            app.setWorkAuthorized(false);
            app.setSubmittedBy(null);
            app.setSubmittedByName(null);
            app.setSubmittedAt(null);
            app.setApprovedBy(null);
            app.setApprovedByName(null);
            app.setApprovedAt(null);
            app.setRejectionRemarks(null);
            approvalRepository.save(app);
        } catch (Exception ignored) {}

        return buildRosterForProject(pName);
    }

    /**
     * Deletes a project from the system and cleans up all team hierarchy mappings.
     */
    public void deleteProject(String projectName) {
        if (projectName == null || projectName.trim().isEmpty()) {
            throw new IllegalArgumentException("Project name is required.");
        }
        String pName = projectName.trim();
        clearProjectHierarchy(pName);

        try {
            approvalRepository.deleteById(ProjectHierarchyApproval.normalizeId(pName));
        } catch (Exception ignored) {}

        try {
            projectRepo.findAll().stream()
                    .filter(p -> p.getName() != null && p.getName().equalsIgnoreCase(pName))
                    .forEach(projectRepo::delete);
        } catch (Exception ignored) {}

        try {
            projectRepository.findAll().stream()
                    .filter(mp -> mp.getProjectName() != null && mp.getProjectName().equalsIgnoreCase(pName))
                    .forEach(projectRepository::delete);
        } catch (Exception ignored) {}
    }

    /**
     * Unassigns a specific lead (Java Lead, Testing Lead, or Project Manager) from the project.
     */
    public ProjectRosterDto unassignProjectLead(String projectName, String leadRoleOrEmail) {
        if (projectName == null || projectName.trim().isEmpty() || leadRoleOrEmail == null) {
            throw new IllegalArgumentException("Project name and lead role/email are required.");
        }
        String pName = projectName.trim();
        String target = leadRoleOrEmail.trim().toLowerCase(Locale.ROOT);

        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            boolean modified = false;

            // Check Project Manager unassignment
            if (target.equals("pm") || target.equals("project_manager") || (h.getProjectManagerEmail() != null && h.getProjectManagerEmail().equalsIgnoreCase(target))) {
                if (h.getManagedProjects() != null) {
                    boolean removed = h.getManagedProjects().removeIf(p -> p.equalsIgnoreCase(pName));
                    if (removed) modified = true;
                }
                if (h.getProjectResponsibilities() != null && h.getProjectResponsibilities().remove(pName) != null) {
                    modified = true;
                }
            }

            // Check Team Leads
            for (LeadNode l : h.getTeamLeads()) {
                boolean matches = (l.getLeadEmail() != null && l.getLeadEmail().equalsIgnoreCase(target))
                        || (l.getLeadRole() != null && l.getLeadRole().equalsIgnoreCase(target))
                        || (l.getLeadTitle() != null && l.getLeadTitle().equalsIgnoreCase(target));
                if (matches) {
                    if (l.getAssignedProjects() != null) {
                        boolean removed = l.getAssignedProjects().removeIf(p -> p.equalsIgnoreCase(pName));
                        if (removed) modified = true;
                    }
                    if (l.getProjectResponsibilities() != null && l.getProjectResponsibilities().remove(pName) != null) {
                        modified = true;
                    }
                    if (l.getMembers() != null) {
                        for (MemberNode m : l.getMembers()) {
                            if (m.getProjectAssignments() != null) {
                                boolean removed = m.getProjectAssignments().removeIf(pa -> pa.getProjectName().equalsIgnoreCase(pName));
                                if (removed) modified = true;
                            }
                        }
                    }
                }
            }
            if (modified) {
                h.setUpdatedAt(new Date());
                hierarchyRepository.save(h);
            }
        }
        return buildRosterForProject(pName);
    }

    /**
     * Retrieves all employees or team leaders configured for Production Support for a given project.
     */
    public List<UserEntity> getProductionSupportUsers(String projectName) {
        if (projectName == null || projectName.trim().isEmpty()) {
            return Collections.emptyList();
        }
        List<UserEntity> result = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        List<TeamHierarchy> all = hierarchyRepository.findAll();
        for (TeamHierarchy h : all) {
            for (LeadNode lead : h.getTeamLeads()) {
                boolean leadAssigned = lead.getAssignedProjects() != null &&
                        lead.getAssignedProjects().stream().anyMatch(p -> projectMatches(p, projectName));
                boolean leadHasProd = Boolean.TRUE.equals(lead.getProjectProductionSupport().get(projectName))
                        || (leadAssigned && Boolean.TRUE.equals(lead.getProductionSupport()));
                if (leadAssigned && leadHasProd) {
                    UserEntity leadUser = lead.getLeadId() != null ? userRepository.findById(lead.getLeadId()).orElse(null) : null;
                    if (leadUser == null && lead.getLeadEmail() != null) {
                        leadUser = userRepository.findByEmailIgnoreCase(lead.getLeadEmail()).orElse(null);
                    }
                    if (leadUser != null && seen.add(leadUser.getId())) {
                        result.add(leadUser);
                    }
                }
                for (MemberNode m : lead.getMembers()) {
                    if (m.getProjectAssignments() != null) {
                        for (ProjectAssignment pa : m.getProjectAssignments()) {
                            if (pa != null && pa.getProjectName() != null && projectMatches(pa.getProjectName(), projectName)
                                    && Boolean.TRUE.equals(pa.getProductionSupport())) {
                                UserEntity mUser = m.getMemberId() != null ? userRepository.findById(m.getMemberId()).orElse(null) : null;
                                if (mUser == null && m.getMemberEmail() != null) {
                                    mUser = userRepository.findByEmailIgnoreCase(m.getMemberEmail()).orElse(null);
                                }
                                if (mUser != null && seen.add(mUser.getId())) {
                                    result.add(mUser);
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }
        return result;
    }

    /**
     * Checks if a user is configured for Production Support on a specific project.
     */
    public boolean isUserConfiguredForProductionSupport(String userEmail, String projectName) {
        if (userEmail == null || userEmail.trim().isEmpty() || projectName == null || projectName.trim().isEmpty()) {
            return false;
        }
        String email = userEmail.trim().toLowerCase(Locale.ROOT);
        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            for (LeadNode lead : h.getTeamLeads()) {
                if (lead.getLeadEmail() != null && lead.getLeadEmail().equalsIgnoreCase(email)) {
                    boolean leadAssigned = lead.getAssignedProjects() != null &&
                            lead.getAssignedProjects().stream().anyMatch(p -> projectMatches(p, projectName));
                    if (leadAssigned && (Boolean.TRUE.equals(lead.getProjectProductionSupport().get(projectName))
                            || Boolean.TRUE.equals(lead.getProductionSupport()))) {
                        return true;
                    }
                }
                for (MemberNode m : lead.getMembers()) {
                    if (m.getMemberEmail() != null && m.getMemberEmail().equalsIgnoreCase(email) && m.getProjectAssignments() != null) {
                        for (ProjectAssignment pa : m.getProjectAssignments()) {
                            if (pa != null && projectMatches(pa.getProjectName(), projectName) && Boolean.TRUE.equals(pa.getProductionSupport())) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * Checks if a user is configured for Production Support on any project.
     */
    public boolean isUserConfiguredForProductionSupportAnyProject(String userEmail) {
        if (userEmail == null || userEmail.trim().isEmpty()) {
            return false;
        }
        String email = userEmail.trim().toLowerCase(Locale.ROOT);
        for (TeamHierarchy h : hierarchyRepository.findAll()) {
            for (LeadNode lead : h.getTeamLeads()) {
                if (lead.getLeadEmail() != null && lead.getLeadEmail().equalsIgnoreCase(email)) {
                    if (Boolean.TRUE.equals(lead.getProductionSupport()) || (lead.getProjectProductionSupport() != null && lead.getProjectProductionSupport().containsValue(true))) {
                        return true;
                    }
                }
                for (MemberNode m : lead.getMembers()) {
                    if (m.getMemberEmail() != null && m.getMemberEmail().equalsIgnoreCase(email)) {
                        if (Boolean.TRUE.equals(m.getProductionSupport())) {
                            return true;
                        }
                        if (m.getProjectAssignments() != null) {
                            for (ProjectAssignment pa : m.getProjectAssignments()) {
                                if (pa != null && Boolean.TRUE.equals(pa.getProductionSupport())) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        return false;
    }
}
