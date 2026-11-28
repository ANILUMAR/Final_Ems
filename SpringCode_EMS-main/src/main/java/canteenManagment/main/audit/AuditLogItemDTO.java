package canteenManagment.main.audit;

import java.util.Date;

public class AuditLogItemDTO {
    private String id;
    private String category; // STATUS_CHANGE, TICKET_DELETION, TIMESHEET, SECURITY_RBAC, SYSTEM
    private String action;
    private String entityType; // TASK, BUG, TIMESHEET, ROLE_PERMISSION, USER
    private String entityId;
    private String entityCode;
    private String entityTitle;
    private String actorName;
    private String actorEmail;
    private String actorRole;
    private String fromValue;
    private String toValue;
    private String details;
    private String remarks;
    private String severity; // INFO, SUCCESS, WARNING, DANGER
    private Date timestamp;

    public AuditLogItemDTO() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public String getEntityId() {
        return entityId;
    }

    public void setEntityId(String entityId) {
        this.entityId = entityId;
    }

    public String getEntityCode() {
        return entityCode;
    }

    public void setEntityCode(String entityCode) {
        this.entityCode = entityCode;
    }

    public String getEntityTitle() {
        return entityTitle;
    }

    public void setEntityTitle(String entityTitle) {
        this.entityTitle = entityTitle;
    }

    public String getActorName() {
        return actorName;
    }

    public void setActorName(String actorName) {
        this.actorName = actorName;
    }

    public String getActorEmail() {
        return actorEmail;
    }

    public void setActorEmail(String actorEmail) {
        this.actorEmail = actorEmail;
    }

    public String getActorRole() {
        return actorRole;
    }

    public void setActorRole(String actorRole) {
        this.actorRole = actorRole;
    }

    public String getFromValue() {
        return fromValue;
    }

    public void setFromValue(String fromValue) {
        this.fromValue = fromValue;
    }

    public String getToValue() {
        return toValue;
    }

    public void setToValue(String toValue) {
        this.toValue = toValue;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public Date getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Date timestamp) {
        this.timestamp = timestamp;
    }
}
