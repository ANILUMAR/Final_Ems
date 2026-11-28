package canteenManagment.main.hierarchy;

public class ProjectAssignment {
    private String projectName;
    private String priority; // HIGH, MEDIUM, LOW
    private Integer allocation; // e.g. 50, 100
    private String notes;
    private String responsibilities;
    private Boolean productionSupport = false;

    public ProjectAssignment() {}

    public ProjectAssignment(String projectName, String priority, Integer allocation, String notes) {
        this.projectName = projectName;
        this.priority = priority;
        this.allocation = allocation;
        this.notes = notes;
        this.responsibilities = notes;
        this.productionSupport = false;
    }

    public ProjectAssignment(String projectName, String priority, Integer allocation, String notes, String responsibilities) {
        this.projectName = projectName;
        this.priority = priority;
        this.allocation = allocation;
        this.notes = notes;
        this.responsibilities = responsibilities != null ? responsibilities : notes;
        this.productionSupport = false;
    }

    public Boolean getProductionSupport() {
        return productionSupport != null && productionSupport;
    }

    public void setProductionSupport(Boolean productionSupport) {
        this.productionSupport = productionSupport != null ? productionSupport : false;
    }

    public String getResponsibilities() {
        return responsibilities != null ? responsibilities : notes;
    }

    public void setResponsibilities(String responsibilities) {
        this.responsibilities = responsibilities;
        if (this.notes == null || this.notes.trim().isEmpty()) {
            this.notes = responsibilities;
        }
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public Integer getAllocation() {
        return allocation;
    }

    public void setAllocation(Integer allocation) {
        this.allocation = allocation;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
