package canteenManagment.main.UserEntity;

import java.util.Date;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One row per status transition, for both work models. It is the activity feed
 * behind the "status history" dialog and the audit trail of who moved what.
 */
@Document(collection = "status_history")
public class StatusChange {

    @Id
    private Long id;

    /** {@code TASK} or {@code ASSIGNMENT}. */
    private String entityType;

    private Long entityId;

    private String entityTitle;

    private WorkStatus fromStatus;

    private WorkStatus toStatus;

    private String actorEmail;

    private String actorName;

    private String note;

    private Date changedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public Long getEntityId() {
        return entityId;
    }

    public void setEntityId(Long entityId) {
        this.entityId = entityId;
    }

    public String getEntityTitle() {
        return entityTitle;
    }

    public void setEntityTitle(String entityTitle) {
        this.entityTitle = entityTitle;
    }

    public WorkStatus getFromStatus() {
        return fromStatus;
    }

    public void setFromStatus(WorkStatus fromStatus) {
        this.fromStatus = fromStatus;
    }

    public WorkStatus getToStatus() {
        return toStatus;
    }

    public void setToStatus(WorkStatus toStatus) {
        this.toStatus = toStatus;
    }

    public String getActorEmail() {
        return actorEmail;
    }

    public void setActorEmail(String actorEmail) {
        this.actorEmail = actorEmail;
    }

    public String getActorName() {
        return actorName;
    }

    public void setActorName(String actorName) {
        this.actorName = actorName;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Date getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(Date changedAt) {
        this.changedAt = changedAt;
    }
}
