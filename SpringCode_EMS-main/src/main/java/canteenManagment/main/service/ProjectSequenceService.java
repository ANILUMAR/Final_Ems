package canteenManagment.main.service;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.annotation.PostConstruct;

import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.stereotype.Service;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.ReturnDocument;
import com.mongodb.client.model.Updates;

import canteenManagment.main.UserEntity.AssignBug;
import canteenManagment.main.UserEntity.AssignTask;
import canteenManagment.main.userReposerity.AssignBugRepository;
import canteenManagment.main.userReposerity.assignTaskRepository;

/**
 * Generates unique, independent numbering sequences for Tasks and Bugs project-wise.
 *
 * <p>Tasks and Bugs maintain separate independent sequences starting from 1:
 * <ul>
 *   <li>Task IDs: TASK-001, TASK-002, TASK-003, ...</li>
 *   <li>Bug IDs: BUG-001, BUG-002, BUG-003, ...</li>
 * </ul>
 * Each project carries its own independent task and bug sequences.
 */
@Service
public class ProjectSequenceService {

    private static final Logger log = LoggerFactory.getLogger(ProjectSequenceService.class);
    private static final String COUNTERS_COLLECTION = "counters";
    private static final Pattern CODE_PATTERN = Pattern.compile("^(TASK|BUG)-(\\d+)$", Pattern.CASE_INSENSITIVE);

    @Autowired
    private MongoDatabaseFactory databaseFactory;

    @Autowired
    private assignTaskRepository taskRepository;

    @Autowired
    private AssignBugRepository bugRepository;

    @PostConstruct
    public void init() {
        try {
            reconcileAll();
        } catch (Exception e) {
            log.warn("Failed to reconcile project task/bug sequences on boot: {}", e.getMessage());
        }
    }

    /**
     * Generates the next unique code for a Task or Bug in the given project.
     *
     * @param kind "TASK" or "BUG"
     * @param project Project name
     * @return Formatted code, e.g. "TASK-001", "BUG-001"
     */
    public String nextCode(String kind, String project) {
        boolean isBug = "BUG".equalsIgnoreCase(kind == null ? "" : kind.trim());
        String prefix = isBug ? "BUG" : "TASK";
        String normalizedProject = normalizeProject(project);
        String counterKey = "seq_" + prefix.toLowerCase(Locale.ROOT) + "_" + normalizedProject;

        MongoDatabase db = databaseFactory.getMongoDatabase();
        MongoCollection<Document> counters = db.getCollection(COUNTERS_COLLECTION);

        // Ensure counter is initialized to at least the current max sequence
        ensureInitialized(counters, counterKey, prefix, project);

        Document updated = counters.findOneAndUpdate(
                Filters.eq("_id", counterKey),
                Updates.inc("seq", 1L),
                new FindOneAndUpdateOptions().upsert(true).returnDocument(ReturnDocument.AFTER));

        long seq = ((Number) updated.get("seq")).longValue();
        return String.format("%s-%03d", prefix, seq);
    }

    private void ensureInitialized(MongoCollection<Document> counters, String counterKey, String prefix, String project) {
        Document doc = counters.find(Filters.eq("_id", counterKey)).first();
        if (doc != null && doc.get("seq") != null) {
            return;
        }

        // Count / find max from existing items in this project
        long max = findMaxExistingSequence(prefix, project);
        counters.updateOne(
                Filters.eq("_id", counterKey),
                Updates.set("seq", max),
                new com.mongodb.client.model.UpdateOptions().upsert(true));
    }

    private long findMaxExistingSequence(String prefix, String project) {
        long max = 0;
        boolean isBug = "BUG".equalsIgnoreCase(prefix);
        String normProject = normalizeProject(project);

        if (isBug) {
            for (AssignBug bug : bugRepository.findAll()) {
                if (normProject.equals(normalizeProject(bug.getProject()))) {
                    max = Math.max(max, parseSequenceNumber(bug.getTaskCode()));
                }
            }
        } else {
            for (AssignTask task : taskRepository.findAll()) {
                if (normProject.equals(normalizeProject(task.getProject()))) {
                    max = Math.max(max, parseSequenceNumber(task.getTaskCode()));
                }
            }
        }
        return max;
    }

    private long parseSequenceNumber(String code) {
        if (code == null) {
            return 0;
        }
        Matcher matcher = CODE_PATTERN.matcher(code.trim());
        if (matcher.find()) {
            try {
                return Long.parseLong(matcher.group(2));
            } catch (NumberFormatException ignored) {
            }
        }
        return 0;
    }

    private String normalizeProject(String project) {
        if (project == null || project.trim().isEmpty()) {
            return "default";
        }
        return project.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "_");
    }

    /**
     * Reconciles existing records in the database, formatting any 1-2 digit codes
     * into standard 3-digit format (e.g. TASK-01 -> TASK-001) and ensuring counters
     * match the current state.
     */
    public void reconcileAll() {
        MongoDatabase db = databaseFactory.getMongoDatabase();
        MongoCollection<Document> counters = db.getCollection(COUNTERS_COLLECTION);

        // Normalize existing tasks
        for (AssignTask task : taskRepository.findAll()) {
            String code = task.getTaskCode();
            if (code != null) {
                Matcher m = CODE_PATTERN.matcher(code.trim());
                if (m.find()) {
                    long seq = Long.parseLong(m.group(2));
                    String formatted = String.format("TASK-%03d", seq);
                    if (!formatted.equals(code)) {
                        task.setTaskCode(formatted);
                        taskRepository.save(task);
                    }
                    String counterKey = "seq_task_" + normalizeProject(task.getProject());
                    updateCounterMax(counters, counterKey, seq);
                }
            }
        }

        // Normalize existing bugs
        for (AssignBug bug : bugRepository.findAll()) {
            String code = bug.getTaskCode();
            if (code != null) {
                Matcher m = CODE_PATTERN.matcher(code.trim());
                if (m.find()) {
                    long seq = Long.parseLong(m.group(2));
                    String formatted = String.format("BUG-%03d", seq);
                    if (!formatted.equals(code)) {
                        bug.setTaskCode(formatted);
                        bugRepository.save(bug);
                    }
                    String counterKey = "seq_bug_" + normalizeProject(bug.getProject());
                    updateCounterMax(counters, counterKey, seq);
                }
            }
        }
    }

    private void updateCounterMax(MongoCollection<Document> counters, String counterKey, long seq) {
        Document current = counters.find(Filters.eq("_id", counterKey)).first();
        long currentVal = current != null && current.get("seq") != null ? ((Number) current.get("seq")).longValue() : 0;
        if (seq > currentVal) {
            counters.updateOne(
                    Filters.eq("_id", counterKey),
                    Updates.set("seq", seq),
                    new com.mongodb.client.model.UpdateOptions().upsert(true));
        }
    }
}
