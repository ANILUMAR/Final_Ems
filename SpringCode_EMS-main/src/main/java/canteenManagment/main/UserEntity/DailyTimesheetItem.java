package canteenManagment.main.UserEntity;

public class DailyTimesheetItem {
    private String id;
    private String project;
    private Long taskId;
    private String taskCode;
    private String taskTitle;
    private String kind; // TASK, BUG, OTHER
    private String workDescription;
    private Double hours;
    private String remarks;

    public DailyTimesheetItem() {}

    public DailyTimesheetItem(String id, String project, Long taskId, String taskCode, String taskTitle,
                              String kind, String workDescription, Double hours, String remarks) {
        this.id = id;
        this.project = project;
        this.taskId = taskId;
        this.taskCode = taskCode;
        this.taskTitle = taskTitle;
        this.kind = kind;
        this.workDescription = workDescription;
        this.hours = hours;
        this.remarks = remarks;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getProject() {
        return project;
    }

    public void setProject(String project) {
        this.project = project;
    }

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public String getTaskCode() {
        return taskCode;
    }

    public void setTaskCode(String taskCode) {
        this.taskCode = taskCode;
    }

    public String getTaskTitle() {
        return taskTitle;
    }

    public void setTaskTitle(String taskTitle) {
        this.taskTitle = taskTitle;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getWorkDescription() {
        return workDescription;
    }

    public void setWorkDescription(String workDescription) {
        this.workDescription = workDescription;
    }

    public Double getHours() {
        return hours;
    }

    public void setHours(Double hours) {
        this.hours = hours;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }
}
