package canteenManagment.main.mongo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

/**
 * Creates the indexes every scoped query relies on. Mongo only scans a
 * collection without them, which is fine for the demo dataset but not once a
 * workspace holds 40 employees and a year of tasks and timesheets.
 *
 * Creation is best effort: an index that already exists (or cannot be built
 * because legacy duplicates are present) is logged and skipped instead of
 * stopping the application.
 */
@Component
public class MongoIndexInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MongoIndexInitializer.class);

    private final MongoTemplate mongoTemplate;

    @Autowired
    public MongoIndexInitializer(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Login and the employee directory look users up by email; two accounts
        // may never share one.
        ensure("user", "user_email", new Index().on("email", Sort.Direction.ASC).unique());
        ensure("user", "user_role", new Index().on("role", Sort.Direction.ASC));

        // "My tasks" filters by the embedded owner email / id.
        ensure("task", "task_owner_email", new Index().on("user.email", Sort.Direction.ASC));
        ensure("task", "task_project", new Index().on("project.id", Sort.Direction.ASC));
        ensure("task", "task_status", new Index().on("status", Sort.Direction.ASC));

        ensure("AssignTask", "assignment_owner", new Index().on("assignedTo._id", Sort.Direction.ASC));
        ensure("AssignTask", "assignment_owner_name", new Index().on("assignedToName", Sort.Direction.ASC));
        ensure("AssignTask", "assignment_status", new Index().on("status", Sort.Direction.ASC));

        ensure("timesheet_entry", "timesheet_owner", new Index().on("employeeName", Sort.Direction.ASC));
        ensure("timesheet_entry", "timesheet_date", new Index().on("date", Sort.Direction.DESC));

        // Activity feed: newest first, always filtered by the work item.
        ensure("status_history", "history_entity", new Index()
                .on("entityType", Sort.Direction.ASC)
                .on("entityId", Sort.Direction.ASC)
                .on("changedAt", Sort.Direction.DESC));

        // Portfolio and the assignment picker look projects up by name.
        ensure("project", "project_name", new Index().on("name", Sort.Direction.ASC).unique());
        ensure("master_project_tbl", "master_project_name", new Index().on("projectName", Sort.Direction.ASC));
    }

    private void ensure(String collection, String name, Index index) {
        try {
            mongoTemplate.indexOps(collection).ensureIndex(index);
            log.info("Index {} ready on {}", name, collection);
        } catch (Exception e) {
            log.warn("Could not create index {} on {}: {}", name, collection, e.getMessage());
        }
    }
}
