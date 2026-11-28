package canteenManagment.main.service;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import canteenManagment.main.UserEntity.AssignTask;
import canteenManagment.main.UserEntity.Task;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.hierarchy.LeadNode;
import canteenManagment.main.hierarchy.MemberNode;
import canteenManagment.main.hierarchy.TeamHierarchy;
import canteenManagment.main.hierarchy.TeamHierarchyRepository;
import canteenManagment.main.security.Roles;
import canteenManagment.main.userReposerity.UserRepository;

/**
 * The two notices the workflow promises by mail.
 *
 * <ul>
 *   <li>a task is handed to somebody - the new owner hears about it;</li>
 *   <li>a task reaches DONE - the team leads (the administrator accounts) hear
 *       about it.</li>
 * </ul>
 *
 * Mail is a side effect, never a step of the request: a missing SMTP server or a
 * refused message must not fail the task action that triggered it. When
 * {@code ems.mail.enabled} is false the notice is written to the log instead, so
 * the flow can be followed without a mail account.
 */
@Service
public class TaskMailService {

    private static final Logger log = LoggerFactory.getLogger(TaskMailService.class);
    private static final String DATE_PATTERN = "dd MMM yyyy";

    /**
     * Absent when no SMTP host is configured: Spring only creates the sender
     * bean for a real mail setup, and a notice is still not an error then.
     */
    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private UserRepository userRepository;

    @Autowired(required = false)
    private TeamHierarchyRepository hierarchyRepository;

    @Value("${ems.mail.enabled:false}")
    private boolean enabled;

    @Value("${ems.mail.from:no-reply@ems.local}")
    private String from;

    @Value("${ems.app.url:http://localhost:4200}")
    private String appUrl;

    /**
     * One daemon thread for every notice: deliveries stay in order but never run
     * on a request thread.
     */
    private final ExecutorService mailQueue = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "ems-task-mail");
        thread.setDaemon(true);
        return thread;
    });

    /** "You have new work" - sent to the person the task now belongs to. */
    public void taskAssigned(AssignTask task, String assignedBy) {
        if (task == null || task.getAssignedTo() == null) {
            return;
        }
        String ownerEmail = task.getAssignedTo().getEmail();
        String ownerName = firstNonBlank(task.getAssignedTo().getName(), ownerEmail);

        StringBuilder body = new StringBuilder();
        body.append("Hello ").append(ownerName).append(",\n\n")
                .append("A new task has been assigned to you.\n\n");
        appendIfPresent(body, "Task", task.getTaskTitle());
        appendIfPresent(body, "Project", task.getProject());
        appendIfPresent(body, "Priority", task.getPriority());
        appendIfPresent(body, "Module", task.getModule());
        appendIfPresent(body, "Due", formatDate(task.getEndDate()));
        appendIfPresent(body, "Assigned by", assignedBy);
        body.append("\nOpen My Tasks to pick it up:\n")
                .append(appUrl).append("/my-tasks\n\n")
                .append("- Employee Management System");

        send(ownerEmail, "[EMS] Task assigned: " + firstNonBlank(task.getTaskTitle(), "Untitled task"), body.toString());
    }

    /** "This is done" - delegates dynamically based on whether task was in testing verification or development. */
    public void taskCompleted(AssignTask task, String actorEmail) {
        if (task == null) {
            return;
        }
        if (Boolean.TRUE.equals(task.getReleasedForTesting()) || "VERIFIED".equalsIgnoreCase(task.getTestingStatus())) {
            notifyTestingTaskCompleted(task, actorEmail);
        } else {
            notifyDeveloperTaskCompleted(task, actorEmail);
        }
    }

    /** The same notice for the project-side work model. */
    public void taskCompleted(Task task, String actorEmail) {
        if (task == null) {
            return;
        }
        notifyDeveloperTaskCompleted(task, actorEmail);
    }

    /**
     * Developer Status - Done: Automatically notify Reporting Team Leader with Project Manager in CC.
     */
    public void notifyDeveloperTaskCompleted(AssignTask task, String actorEmail) {
        if (task == null) {
            return;
        }
        String devEmail = task.getAssignedTo() != null ? task.getAssignedTo().getEmail() : actorEmail;
        String devName = firstNonBlank(task.getAssignedTo() != null ? task.getAssignedTo().getName() : null, actorEmail);
        String project = task.getProject();
        String title = firstNonBlank(task.getTaskTitle(), "Untitled task");
        String code = firstNonBlank(task.getTaskCode(), "Task #" + task.getId());

        String leadEmail = resolveDevTeamLeader(project, devEmail);
        String managerEmail = resolveProjectManager(project, devEmail);

        StringBuilder body = new StringBuilder();
        body.append("Hello Team Leader,\n\n")
                .append("A developer has marked the task status as DONE.\n\n");
        appendIfPresent(body, "Task Code", code);
        appendIfPresent(body, "Task Title", title);
        appendIfPresent(body, "Project", project);
        appendIfPresent(body, "Priority", task.getPriority());
        appendIfPresent(body, "Developer", devName + (devEmail != null ? " (" + devEmail + ")" : ""));
        appendIfPresent(body, "Completed By", firstNonBlank(actorEmail, devEmail));
        appendIfPresent(body, "Completed At", formatDate(new Date()));
        if (managerEmail != null && !managerEmail.isEmpty()) {
            appendIfPresent(body, "Manager (CC)", managerEmail);
        }
        body.append("\nReview and release this task for QA verification:\n")
                .append(appUrl).append("/developer-completed\n\n")
                .append("- Employee Management System");

        String[] to = leadEmail != null ? new String[]{ leadEmail } : teamLeadEmails().toArray(new String[0]);
        String[] cc = (managerEmail != null && !managerEmail.equalsIgnoreCase(leadEmail)) ? new String[]{ managerEmail } : null;

        send(to, cc, "[EMS] Developer Status Done: " + title, body.toString());
    }

    /**
     * Developer Status - Done for Task entity.
     */
    public void notifyDeveloperTaskCompleted(Task task, String actorEmail) {
        if (task == null) {
            return;
        }
        String devEmail = task.getUser() != null ? task.getUser().getEmail() : actorEmail;
        String devName = firstNonBlank(task.getUser() != null ? task.getUser().getName() : null, actorEmail);
        String project = task.getProject() != null ? task.getProject().getName() : null;
        String title = firstNonBlank(task.getTitle(), "Untitled task");

        String leadEmail = resolveDevTeamLeader(project, devEmail);
        String managerEmail = resolveProjectManager(project, devEmail);

        StringBuilder body = new StringBuilder();
        body.append("Hello Team Leader,\n\n")
                .append("A developer has marked the task status as DONE.\n\n");
        appendIfPresent(body, "Task Title", title);
        appendIfPresent(body, "Project", project);
        appendIfPresent(body, "Developer", devName + (devEmail != null ? " (" + devEmail + ")" : ""));
        appendIfPresent(body, "Completed By", firstNonBlank(actorEmail, devEmail));
        appendIfPresent(body, "Completed At", formatDate(new Date()));
        if (managerEmail != null && !managerEmail.isEmpty()) {
            appendIfPresent(body, "Manager (CC)", managerEmail);
        }
        body.append("\nReview the completed task on the board:\n")
                .append(appUrl).append("/tasks\n\n")
                .append("- Employee Management System");

        String[] to = leadEmail != null ? new String[]{ leadEmail } : teamLeadEmails().toArray(new String[0]);
        String[] cc = (managerEmail != null && !managerEmail.equalsIgnoreCase(leadEmail)) ? new String[]{ managerEmail } : null;

        send(to, cc, "[EMS] Developer Status Done: " + title, body.toString());
    }

    /**
     * Testing Status - Done: Automatically notify Testing Team Leader with Project Manager in CC.
     */
    public void notifyTestingTaskCompleted(AssignTask task, String actorEmail) {
        if (task == null) {
            return;
        }
        String testerEmail = firstNonBlank(task.getAssignedTesterEmail(),
                task.getAssignedTester() != null ? task.getAssignedTester().getEmail() : actorEmail);
        String testerName = firstNonBlank(task.getAssignedTesterName(),
                task.getAssignedTester() != null ? task.getAssignedTester().getName() : actorEmail);
        String project = task.getProject();
        String title = firstNonBlank(task.getTaskTitle(), "Untitled task");
        String code = firstNonBlank(task.getTaskCode(), "Task #" + task.getId());

        String testingLeadEmail = resolveTestingTeamLeader(project, testerEmail);
        String managerEmail = resolveProjectManager(project, testerEmail);

        StringBuilder body = new StringBuilder();
        body.append("Hello Testing Team Leader,\n\n")
                .append("A tester has verified the task and marked testing status as DONE (PASSED/VERIFIED).\n\n");
        appendIfPresent(body, "Task Code", code);
        appendIfPresent(body, "Task Title", title);
        appendIfPresent(body, "Project", project);
        appendIfPresent(body, "Testing Status", firstNonBlank(task.getTestingStatus(), "VERIFIED"));
        appendIfPresent(body, "Tester", testerName + (testerEmail != null ? " (" + testerEmail + ")" : ""));
        appendIfPresent(body, "Verified By", firstNonBlank(actorEmail, testerEmail));
        appendIfPresent(body, "Completed At", formatDate(new Date()));
        if (task.getVerificationNote() != null && !task.getVerificationNote().trim().isEmpty()) {
            appendIfPresent(body, "Verification Note", task.getVerificationNote());
        }
        if (managerEmail != null && !managerEmail.isEmpty()) {
            appendIfPresent(body, "Manager (CC)", managerEmail);
        }
        body.append("\nReview the QA verification sign-off:\n")
                .append(appUrl).append("/tested-completed\n\n")
                .append("- Employee Management System");

        String[] to = testingLeadEmail != null ? new String[]{ testingLeadEmail } : testingLeadEmails().toArray(new String[0]);
        String[] cc = (managerEmail != null && !managerEmail.equalsIgnoreCase(testingLeadEmail)) ? new String[]{ managerEmail } : null;

        send(to, cc, "[EMS] Testing Status Done: " + title, body.toString());
    }

    /**
     * Dynamically resolves the Reporting Team Leader for a developer based on TeamHierarchy.
     */
    public String resolveDevTeamLeader(String projectName, String developerEmail) {
        if (hierarchyRepository != null) {
            List<TeamHierarchy> hierarchies = hierarchyRepository.findAll();
            // 1. Direct reporting hierarchy by developer email
            if (developerEmail != null && !developerEmail.trim().isEmpty()) {
                String dev = developerEmail.trim();
                for (TeamHierarchy h : hierarchies) {
                    if (h.getTeamLeads() != null) {
                        for (LeadNode lead : h.getTeamLeads()) {
                            if (lead.getMembers() != null) {
                                for (MemberNode member : lead.getMembers()) {
                                    if (member.getMemberEmail() != null && member.getMemberEmail().equalsIgnoreCase(dev)) {
                                        if (lead.getLeadEmail() != null && !lead.getLeadEmail().trim().isEmpty()) {
                                            return lead.getLeadEmail().trim();
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // 2. Project dev lead from project assignment
            if (projectName != null && !projectName.trim().isEmpty()) {
                for (TeamHierarchy h : hierarchies) {
                    if (h.getTeamLeads() != null) {
                        for (LeadNode lead : h.getTeamLeads()) {
                            boolean isDevLeadRole = Roles.isDeveloperLead(lead.getLeadRole()) || Roles.isTeamLead(lead.getLeadRole());
                            if (isDevLeadRole && lead.getAssignedProjects() != null) {
                                for (String p : lead.getAssignedProjects()) {
                                    if (projectName.equalsIgnoreCase(p)) {
                                        if (lead.getLeadEmail() != null && !lead.getLeadEmail().trim().isEmpty()) {
                                            return lead.getLeadEmail().trim();
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // 3. Fallback: query active DEVELOPER_LEAD or TEAM_LEAD in UserRepository
        for (UserEntity u : userRepository.findAll()) {
            if (Boolean.FALSE.equals(u.getActive())) continue;
            if (Roles.isDeveloperLead(u.getRole()) || Roles.isTeamLead(u.getRole())) {
                if (u.getEmail() != null && !u.getEmail().trim().isEmpty()) {
                    return u.getEmail().trim();
                }
            }
        }
        return null;
    }

    /**
     * Dynamically resolves the Testing Team Leader for a tester based on TeamHierarchy.
     */
    public String resolveTestingTeamLeader(String projectName, String testerEmail) {
        if (hierarchyRepository != null) {
            List<TeamHierarchy> hierarchies = hierarchyRepository.findAll();
            // 1. Direct reporting hierarchy by tester email
            if (testerEmail != null && !testerEmail.trim().isEmpty()) {
                String tester = testerEmail.trim();
                for (TeamHierarchy h : hierarchies) {
                    if (h.getTeamLeads() != null) {
                        for (LeadNode lead : h.getTeamLeads()) {
                            if (lead.getMembers() != null) {
                                for (MemberNode member : lead.getMembers()) {
                                    if (member.getMemberEmail() != null && member.getMemberEmail().equalsIgnoreCase(tester)) {
                                        if (lead.getLeadEmail() != null && !lead.getLeadEmail().trim().isEmpty()) {
                                            return lead.getLeadEmail().trim();
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // 2. Project tester lead from project assignment
            if (projectName != null && !projectName.trim().isEmpty()) {
                for (TeamHierarchy h : hierarchies) {
                    if (h.getTeamLeads() != null) {
                        for (LeadNode lead : h.getTeamLeads()) {
                            boolean isTesterLeadRole = Roles.isTesterLead(lead.getLeadRole()) || Roles.isTeamLead(lead.getLeadRole());
                            if (isTesterLeadRole && lead.getAssignedProjects() != null) {
                                for (String p : lead.getAssignedProjects()) {
                                    if (projectName.equalsIgnoreCase(p)) {
                                        if (lead.getLeadEmail() != null && !lead.getLeadEmail().trim().isEmpty()) {
                                            return lead.getLeadEmail().trim();
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // 3. Fallback: query active TESTER_LEAD in UserRepository
        for (UserEntity u : userRepository.findAll()) {
            if (Boolean.FALSE.equals(u.getActive())) continue;
            if (Roles.isTesterLead(u.getRole())) {
                if (u.getEmail() != null && !u.getEmail().trim().isEmpty()) {
                    return u.getEmail().trim();
                }
            }
        }
        return null;
    }

    /**
     * Dynamically resolves the Project Manager for CC based on TeamHierarchy or project assignment.
     */
    public String resolveProjectManager(String projectName, String userEmail) {
        if (hierarchyRepository != null) {
            List<TeamHierarchy> hierarchies = hierarchyRepository.findAll();
            // 1. Project manager whose hierarchy includes the user
            if (userEmail != null && !userEmail.trim().isEmpty()) {
                String target = userEmail.trim();
                for (TeamHierarchy h : hierarchies) {
                    if (h.getTeamLeads() != null) {
                        for (LeadNode lead : h.getTeamLeads()) {
                            if (target.equalsIgnoreCase(lead.getLeadEmail())) {
                                if (h.getProjectManagerEmail() != null && !h.getProjectManagerEmail().trim().isEmpty()) {
                                    return h.getProjectManagerEmail().trim();
                                }
                            }
                            if (lead.getMembers() != null) {
                                for (MemberNode member : lead.getMembers()) {
                                    if (member.getMemberEmail() != null && target.equalsIgnoreCase(member.getMemberEmail())) {
                                        if (h.getProjectManagerEmail() != null && !h.getProjectManagerEmail().trim().isEmpty()) {
                                            return h.getProjectManagerEmail().trim();
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // 2. Project manager managing the project
            if (projectName != null && !projectName.trim().isEmpty()) {
                for (TeamHierarchy h : hierarchies) {
                    if (h.getManagedProjects() != null) {
                        for (String p : h.getManagedProjects()) {
                            if (projectName.equalsIgnoreCase(p)) {
                                if (h.getProjectManagerEmail() != null && !h.getProjectManagerEmail().trim().isEmpty()) {
                                    return h.getProjectManagerEmail().trim();
                                }
                            }
                        }
                    }
                }
            }
        }
        // 3. Fallback: active PROJECT_MANAGER in UserRepository
        for (UserEntity u : userRepository.findAll()) {
            if (Boolean.FALSE.equals(u.getActive())) continue;
            if (Roles.PROJECT_MANAGER.equals(Roles.raw(u.getRole()))) {
                if (u.getEmail() != null && !u.getEmail().trim().isEmpty()) {
                    return u.getEmail().trim();
                }
            }
        }
        // 4. Ultimate fallback: active SUPER_ADMIN
        for (UserEntity u : userRepository.findAll()) {
            if (Boolean.FALSE.equals(u.getActive())) continue;
            if (Roles.isSuperAdmin(u.getRole())) {
                if (u.getEmail() != null && !u.getEmail().trim().isEmpty()) {
                    return u.getEmail().trim();
                }
            }
        }
        return null;
    }

    /**
     * "Something is waiting for your review" - sent to the people who approve
     * the testing team's reports, once when it is raised and again when a
     * corrected item comes back.
     */
    public void submissionRaised(AssignTask task) {
        if (task == null) {
            return;
        }
        String code = firstNonBlank(task.getTaskCode(), "Unnumbered item");
        StringBuilder body = new StringBuilder();
        body.append("A task or bug from the testing team is waiting for your review.\n\n");
        appendIfPresent(body, "Task ID", code);
        appendIfPresent(body, "Kind", task.getKind());
        appendIfPresent(body, "Title", task.getTaskTitle());
        appendIfPresent(body, "Project", task.getProject());
        appendIfPresent(body, "Priority", task.getPriority());
        appendIfPresent(body, "Raised by", firstNonBlank(task.getCreatedByName(), task.getCreatedBy()));
        body.append("\nApprove or send it back here:\n")
                .append(appUrl).append("/approvals\n\n")
                .append("- Employee Management System");

        List<String> reviewers = testingLeadEmails();
        if (reviewers.isEmpty()) {
            log.info("No testing team leader to notify about \"{}\".", code);
            return;
        }
        send(reviewers.toArray(new String[0]),
                "[EMS] Awaiting review: " + code + " - " + firstNonBlank(task.getTaskTitle(), "untitled"),
                body.toString());
    }

    /**
     * The decision, back to the tester who raised it. A rejection carries the
     * comment, because that comment is what they correct against.
     */
    public void submissionReviewed(AssignTask task, boolean approved, String note, String reviewerEmail) {
        if (task == null || task.getCreatedBy() == null || task.getCreatedBy().trim().isEmpty()) {
            return;
        }
        String code = firstNonBlank(task.getTaskCode(), "Unnumbered item");
        StringBuilder body = new StringBuilder();
        body.append("Hello ").append(firstNonBlank(task.getCreatedByName(), "there")).append(",\n\n")
                .append(approved
                        ? "Your submission was approved and is now with the developer team leader for assignment.\n\n"
                        : "Your submission was sent back for correction.\n\n");
        appendIfPresent(body, "Task ID", code);
        appendIfPresent(body, "Kind", task.getKind());
        appendIfPresent(body, "Title", task.getTaskTitle());
        appendIfPresent(body, "Project", task.getProject());
        appendIfPresent(body, "Reviewed by", firstNonBlank(reviewerEmail, task.getReviewedBy()));
        appendIfPresent(body, "Comment", note);
        body.append(approved
                        ? "\nFollow it here:\n" + appUrl + "/my-submissions\n\n"
                        : "\nCorrect it here and send it again:\n" + appUrl + "/my-submissions\n\n")
                .append("- Employee Management System");

        send(task.getCreatedBy(),
                "[EMS] " + (approved ? "Approved" : "Sent back") + ": " + code
                        + " - " + firstNonBlank(task.getTaskTitle(), "untitled"),
                body.toString());
    }

    /** Active testing team leaders: the people who approve what testers raise. */
    private List<String> testingLeadEmails() {
        List<String> emails = new ArrayList<>();
        for (UserEntity user : userRepository.findAll()) {
            if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
                continue;
            }
            if (!Roles.isTesterLead(user.getRole())) {
                continue;
            }
            if (Boolean.FALSE.equals(user.getActive())) {
                continue;
            }
            emails.add(user.getEmail());
        }
        return emails;
    }

    /** Active people who run the work: the CEO and both team leaders. */
    public List<String> teamLeadEmails() {
        List<String> emails = new ArrayList<>();
        for (UserEntity user : userRepository.findAll()) {
            if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
                continue;
            }
            if (!Roles.isSuperAdmin(user.getRole()) && !Roles.isLead(user.getRole())) {
                continue;
            }
            if (Boolean.FALSE.equals(user.getActive())) {
                continue;
            }
            emails.add(user.getEmail());
        }
        return emails;
    }

    private void sendToTeamLeads(String subject, String body) {
        List<String> leads = teamLeadEmails();
        if (leads.isEmpty()) {
            log.info("No administrator account to notify about \"{}\".", subject);
            return;
        }
        send(leads.toArray(new String[0]), subject, body);
    }

    private void send(String to, String subject, String body) {
        send(new String[] { to }, null, subject, body);
    }

    private void send(String[] to, String subject, String body) {
        send(to, null, subject, body);
    }

    private void send(String[] to, String[] cc, String subject, String body) {
        if (to == null || to.length == 0) {
            return;
        }
        // Handed to one background thread: a slow or unreachable mail server must
        // never hold the request that triggered the notice.
        String[] recipients = to.clone();
        String[] ccRecipients = (cc != null && cc.length > 0) ? cc.clone() : null;
        mailQueue.submit(() -> deliver(recipients, ccRecipients, subject, body));
    }

    private void deliver(String[] to, String subject, String body) {
        deliver(to, null, subject, body);
    }

    private void deliver(String[] to, String[] cc, String subject, String body) {
        if (!enabled) {
            // Keeps the promise visible in the log while the workspace runs
            // without a mail account.
            log.info("[mail off] to={} cc={} subject={}\n{}",
                    String.join(",", to),
                    cc != null ? String.join(",", cc) : "none",
                    subject, body);
            return;
        }
        if (mailSender == null) {
            log.warn("[mail on] no SMTP sender is configured (spring.mail.host), skipping \"{}\".", subject);
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(to);
            if (cc != null && cc.length > 0) {
                message.setCc(cc);
            }
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Task notice sent to {} (cc: {}) ({})",
                    String.join(",", to),
                    cc != null ? String.join(",", cc) : "none",
                    subject);
        } catch (Exception e) {
            // A mail outage must never undo or fail the task action behind it.
            log.warn("Could not send \"{}\" to {}: {}", subject, String.join(",", to), e.getMessage());
        }
    }

    /** Notice to reporting person when an employee submits or resubmits their timesheet. */
    public void timesheetSubmitted(canteenManagment.main.UserEntity.DailyTimesheet sheet, String reportingEmail, boolean isResubmit) {
        if (sheet == null || reportingEmail == null || reportingEmail.trim().isEmpty()) {
            return;
        }
        String empName = firstNonBlank(sheet.getEmployeeName(), sheet.getEmployeeEmail());
        String actionText = isResubmit ? "resubmitted" : "submitted";
        String subject = String.format("Timesheet %s: %s (%s, %.1fh)", actionText, empName, sheet.getWorkDate(), sheet.getTotalHours() != null ? sheet.getTotalHours() : 0.0);
        StringBuilder body = new StringBuilder();
        body.append(String.format("Hello,\n\n%s has %s a daily timesheet for your review and approval.\n\n", empName, actionText));
        appendIfPresent(body, "Employee", empName + " (" + sheet.getEmployeeEmail() + ")");
        appendIfPresent(body, "Work Date", String.valueOf(sheet.getWorkDate()));
        appendIfPresent(body, "Total Hours", String.format("%.1f hrs", sheet.getTotalHours() != null ? sheet.getTotalHours() : 0.0));
        appendIfPresent(body, "Tasks/Entries", String.valueOf(sheet.getEntries() != null ? sheet.getEntries().size() : 0));
        if (sheet.getOvertimeRemarks() != null && !sheet.getOvertimeRemarks().trim().isEmpty()) {
            appendIfPresent(body, "Overtime Note", sheet.getOvertimeRemarks());
        }
        body.append("\nPlease review and take action at:\n")
            .append(appUrl).append("/timesheets/approvals\n\nEMS Timesheet System");
        send(new String[]{reportingEmail}, subject, body.toString());
    }

    /** Notice to employee when their timesheet is approved. */
    public void timesheetApproved(canteenManagment.main.UserEntity.DailyTimesheet sheet) {
        if (sheet == null || sheet.getEmployeeEmail() == null || sheet.getEmployeeEmail().trim().isEmpty()) {
            return;
        }
        String reviewer = firstNonBlank(sheet.getReviewedByName(), sheet.getReviewedBy());
        String subject = String.format("Timesheet Approved: %s (%.1fh)", sheet.getWorkDate(), sheet.getTotalHours() != null ? sheet.getTotalHours() : 0.0);
        StringBuilder body = new StringBuilder();
        body.append(String.format("Hello %s,\n\nYour timesheet for %s has been APPROVED by %s.\n\n",
                firstNonBlank(sheet.getEmployeeName(), sheet.getEmployeeEmail()), sheet.getWorkDate(), reviewer != null ? reviewer : "your lead"));
        appendIfPresent(body, "Work Date", String.valueOf(sheet.getWorkDate()));
        appendIfPresent(body, "Total Hours", String.format("%.1f hrs", sheet.getTotalHours() != null ? sheet.getTotalHours() : 0.0));
        appendIfPresent(body, "Status", "APPROVED");
        body.append("\nYou can view your approved timesheets at:\n")
            .append(appUrl).append("/timesheets/my\n\nEMS Timesheet System");
        send(new String[]{sheet.getEmployeeEmail()}, subject, body.toString());
    }

    /** Notice to employee when their timesheet is rejected with mandatory comments. */
    public void timesheetRejected(canteenManagment.main.UserEntity.DailyTimesheet sheet, String reason) {
        if (sheet == null || sheet.getEmployeeEmail() == null || sheet.getEmployeeEmail().trim().isEmpty()) {
            return;
        }
        String reviewer = firstNonBlank(sheet.getReviewedByName(), sheet.getReviewedBy());
        String subject = String.format("Timesheet Needs Revision: %s", sheet.getWorkDate());
        StringBuilder body = new StringBuilder();
        body.append(String.format("Hello %s,\n\nYour timesheet for %s has been sent back by %s for revision.\n\n",
                firstNonBlank(sheet.getEmployeeName(), sheet.getEmployeeEmail()), sheet.getWorkDate(), reviewer != null ? reviewer : "your lead"));
        appendIfPresent(body, "Work Date", String.valueOf(sheet.getWorkDate()));
        appendIfPresent(body, "Total Hours", String.format("%.1f hrs", sheet.getTotalHours() != null ? sheet.getTotalHours() : 0.0));
        appendIfPresent(body, "Status", "REJECTED");
        appendIfPresent(body, "Reason / Note", reason);
        body.append("\nPlease review the feedback, update your timesheet, and resubmit at:\n")
            .append(appUrl).append("/timesheets/new?editDate=").append(sheet.getWorkDate()).append("\n\nEMS Timesheet System");
        send(new String[]{sheet.getEmployeeEmail()}, subject, body.toString());
    }

    private void appendIfPresent(StringBuilder body, String label, String value) {
        if (value == null || value.trim().isEmpty()) {
            return;
        }
        body.append("  ").append(String.format("%-12s", label + ":")).append(value).append('\n');
    }

    private String formatDate(Date date) {
        return date == null ? null : new SimpleDateFormat(DATE_PATTERN).format(date);
    }

    private String firstNonBlank(String first, String fallback) {
        return first == null || first.trim().isEmpty() ? fallback : first;
    }
}
