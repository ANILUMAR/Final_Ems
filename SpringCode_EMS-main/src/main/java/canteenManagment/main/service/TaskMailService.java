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

    /** "This is done" - sent to every administrator once a task reaches DONE. */
    public void taskCompleted(AssignTask task, String actorEmail) {
        if (task == null) {
            return;
        }
        String title = firstNonBlank(task.getTaskTitle(), "Untitled task");
        StringBuilder body = new StringBuilder();
        body.append(firstNonBlank(task.getAssignedTo() == null ? null : task.getAssignedTo().getName(),
                "The owner")).append(" marked a task as done.\n\n");
        appendIfPresent(body, "Task", title);
        appendIfPresent(body, "Project", task.getProject());
        appendIfPresent(body, "Completed by", firstNonBlank(actorEmail, "unknown"));
        appendIfPresent(body, "Completed at", formatDate(new Date()));
        body.append("\nReview it on the task board:\n")
                .append(appUrl).append("/tasks\n\n")
                .append("- Employee Management System");

        sendToTeamLeads("[EMS] Done: " + title, body.toString());
    }

    /** The same notice for the project-side work model. */
    public void taskCompleted(Task task, String actorEmail) {
        if (task == null) {
            return;
        }
        String title = firstNonBlank(task.getTitle(), "Untitled task");
        StringBuilder body = new StringBuilder();
        body.append(firstNonBlank(task.getUser() == null ? null : task.getUser().getName(),
                "The owner")).append(" marked a task as done.\n\n");
        appendIfPresent(body, "Task", title);
        appendIfPresent(body, "Project", task.getProject() == null ? null : task.getProject().getName());
        appendIfPresent(body, "Completed by", firstNonBlank(actorEmail, "unknown"));
        appendIfPresent(body, "Completed at", formatDate(new Date()));
        body.append("\nReview it on the task board:\n")
                .append(appUrl).append("/tasks\n\n")
                .append("- Employee Management System");

        sendToTeamLeads("[EMS] Done: " + title, body.toString());
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
        send(new String[] { to }, subject, body);
    }

    private void send(String[] to, String subject, String body) {
        if (to == null || to.length == 0) {
            return;
        }
        // Handed to one background thread: a slow or unreachable mail server must
        // never hold the request that triggered the notice.
        String[] recipients = to.clone();
        mailQueue.submit(() -> deliver(recipients, subject, body));
    }

    private void deliver(String[] to, String subject, String body) {
        if (!enabled) {
            // Keeps the promise visible in the log while the workspace runs
            // without a mail account.
            log.info("[mail off] to={} subject={}\n{}", String.join(",", to), subject, body);
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
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Task notice sent to {} ({})", String.join(",", to), subject);
        } catch (Exception e) {
            // A mail outage must never undo or fail the task action behind it.
            log.warn("Could not send \"{}\" to {}: {}", subject, String.join(",", to), e.getMessage());
        }
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
