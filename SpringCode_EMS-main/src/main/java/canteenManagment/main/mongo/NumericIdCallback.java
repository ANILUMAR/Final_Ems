package canteenManagment.main.mongo;

import java.lang.reflect.Field;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertCallback;
import org.springframework.stereotype.Component;
import org.springframework.util.ReflectionUtils;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.ReturnDocument;
import com.mongodb.client.model.Sorts;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;

/**
 * MongoDB has no auto-increment, but the Angular client addresses records by
 * numeric id (tasks, timesheets, employees). Every document whose numeric
 * {@code @Id} is still null receives the next value of a per-collection
 * counter, which reproduces the identity behaviour the MySQL schema had.
 */
@Component
public class NumericIdCallback implements BeforeConvertCallback<Object> {

    private static final String COUNTERS = "counters";

    // The driver factory (not MongoTemplate) is injected on purpose: the
    // template depends on the mapping converter, which is what registers this
    // callback, so asking for the template here would create a bean cycle.
    private final MongoDatabaseFactory databaseFactory;
    private final ConcurrentHashMap<Class<?>, Field> idFields = new ConcurrentHashMap<>();

    // Collections whose counter has already been reconciled with the data in
    // this JVM run; keeps the extra lookup to one per collection.
    private final Set<String> reconciled = ConcurrentHashMap.newKeySet();

    @Autowired
    public NumericIdCallback(MongoDatabaseFactory databaseFactory) {
        this.databaseFactory = databaseFactory;
    }

    @Override
    public Object onBeforeConvert(Object entity, String collection) {
        // Raw BSON documents (including the counter rows below) carry their own
        // "_id" and must not pass through the sequence.
        if (entity == null || entity instanceof Document) {
            return entity;
        }

        Field idField = idFields.computeIfAbsent(entity.getClass(), NumericIdCallback::findNumericIdField);
        if (idField == null || ReflectionUtils.getField(idField, entity) != null) {
            return entity;
        }

        long next = nextValue(collection);
        Class<?> type = idField.getType();
        Object value = (type == Integer.class || type == int.class) ? (Object) (int) next : next;
        ReflectionUtils.setField(idField, entity, value);
        return entity;
    }

    private static Field findNumericIdField(Class<?> type) {
        for (Class<?> current = type; current != null && current != Object.class; current = current.getSuperclass()) {
            for (Field field : current.getDeclaredFields()) {
                if (!field.isAnnotationPresent(Id.class)) {
                    continue;
                }
                Class<?> fieldType = field.getType();
                if (fieldType == Long.class || fieldType == long.class
                        || fieldType == Integer.class || fieldType == int.class) {
                    ReflectionUtils.makeAccessible(field);
                    return field;
                }
            }
        }
        return null;
    }

    private long nextValue(String collection) {
        MongoDatabase database = databaseFactory.getMongoDatabase();
        MongoCollection<Document> counters = database.getCollection(COUNTERS);
        if (reconciled.add(collection)) {
            reconcile(database, counters, collection);
        }
        Document counter = counters.findOneAndUpdate(
                Filters.eq("_id", collection),
                Updates.inc("seq", 1L),
                new FindOneAndUpdateOptions().upsert(true).returnDocument(ReturnDocument.AFTER));
        return ((Number) counter.get("seq")).longValue();
    }

    /**
     * Counter documents are created lazily, but a collection may already hold
     * documents with explicit ids (the demo seed does). Lift the counter to the
     * highest id present so the next insert cannot collide with an existing _id.
     */
    private void reconcile(MongoDatabase database, MongoCollection<Document> counters, String collection) {
        Document newest = database.getCollection(collection)
                .find()
                .sort(Sorts.descending("_id"))
                .limit(1)
                .first();
        long highest = (newest != null && newest.get("_id") instanceof Number)
                ? ((Number) newest.get("_id")).longValue()
                : 0L;
        counters.updateOne(Filters.eq("_id", collection),
                Updates.max("seq", highest),
                new UpdateOptions().upsert(true));
    }
}
