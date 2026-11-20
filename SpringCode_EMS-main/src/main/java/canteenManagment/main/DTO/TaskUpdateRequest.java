package canteenManagment.main.DTO;

/**
 * Body for editing an existing assignment. Every field is optional: whatever is
 * left null keeps the stored value, so the dialog only sends what it changed.
 */
public class TaskUpdateRequest {

    private String project;
    private String taskTitle;
    private Long assignedTo;
    /** yyyy-MM-dd, matching the create form's date inputs. */
    private String startDate;
    private String endDate;
    private String priority;
    private String module;
    private String subModule;
    private String screen;
    private String description;
    private String leadNotes;
    private String kind;

    public String getLeadNotes() {
        return leadNotes;
    }

    public void setLeadNotes(String leadNotes) {
        this.leadNotes = leadNotes;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getProject() {
        return project;
    }

    public void setProject(String project) {
        this.project = project;
    }

    public String getTaskTitle() {
        return taskTitle;
    }

    public void setTaskTitle(String taskTitle) {
        this.taskTitle = taskTitle;
    }

    public Long getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(Long assignedTo) {
        this.assignedTo = assignedTo;
    }

    public String getStartDate() {
        return startDate;
    }

    public void setStartDate(String startDate) {
        this.startDate = startDate;
    }

    public String getEndDate() {
        return endDate;
    }

    public void setEndDate(String endDate) {
        this.endDate = endDate;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getModule() {
        return module;
    }

    public void setModule(String module) {
        this.module = module;
    }

    public String getSubModule() {
        return subModule;
    }

    public void setSubModule(String subModule) {
        this.subModule = subModule;
    }

    public String getScreen() {
        return screen;
    }

    public void setScreen(String screen) {
        this.screen = screen;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
