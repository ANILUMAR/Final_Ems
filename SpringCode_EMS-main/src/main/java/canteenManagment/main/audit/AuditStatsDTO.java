package canteenManagment.main.audit;

public class AuditStatsDTO {
    private long totalActivities;
    private long statusTransitions;
    private long deletions;
    private long timesheetEvents;
    private long activeUsers;

    public AuditStatsDTO() {}

    public AuditStatsDTO(long totalActivities, long statusTransitions, long deletions, long timesheetEvents, long activeUsers) {
        this.totalActivities = totalActivities;
        this.statusTransitions = statusTransitions;
        this.deletions = deletions;
        this.timesheetEvents = timesheetEvents;
        this.activeUsers = activeUsers;
    }

    public long getTotalActivities() {
        return totalActivities;
    }

    public void setTotalActivities(long totalActivities) {
        this.totalActivities = totalActivities;
    }

    public long getStatusTransitions() {
        return statusTransitions;
    }

    public void setStatusTransitions(long statusTransitions) {
        this.statusTransitions = statusTransitions;
    }

    public long getDeletions() {
        return deletions;
    }

    public void setDeletions(long deletions) {
        this.deletions = deletions;
    }

    public long getTimesheetEvents() {
        return timesheetEvents;
    }

    public void setTimesheetEvents(long timesheetEvents) {
        this.timesheetEvents = timesheetEvents;
    }

    public long getActiveUsers() {
        return activeUsers;
    }

    public void setActiveUsers(long activeUsers) {
        this.activeUsers = activeUsers;
    }
}
