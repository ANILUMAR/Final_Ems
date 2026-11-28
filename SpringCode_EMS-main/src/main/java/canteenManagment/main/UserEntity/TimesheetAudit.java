package canteenManagment.main.UserEntity;

import java.util.Date;

public class TimesheetAudit {
    private String action; // DRAFT_SAVED, SUBMITTED, RESUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
    private String performedBy;
    private String performedByName;
    private Date timestamp;
    private String comment;

    public TimesheetAudit() {}

    public TimesheetAudit(String action, String performedBy, String performedByName, Date timestamp, String comment) {
        this.action = action;
        this.performedBy = performedBy;
        this.performedByName = performedByName;
        this.timestamp = timestamp;
        this.comment = comment;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getPerformedBy() {
        return performedBy;
    }

    public void setPerformedBy(String performedBy) {
        this.performedBy = performedBy;
    }

    public String getPerformedByName() {
        return performedByName;
    }

    public void setPerformedByName(String performedByName) {
        this.performedByName = performedByName;
    }

    public Date getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Date timestamp) {
        this.timestamp = timestamp;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}
