package canteenManagment.main.hierarchy;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "team_hierarchy")
public class TeamHierarchy {
    @Id
    private String id;

    private Long projectManagerId;
    private String projectManagerName;
    private String projectManagerEmail;
    private String pmResponsibilities;
    private List<String> managedProjects = new ArrayList<>();
    private java.util.Map<String, String> projectResponsibilities = new java.util.HashMap<>();

    private List<LeadNode> teamLeads = new ArrayList<>();

    private Date createdAt;
    private Date updatedAt;

    public TeamHierarchy() {}

    public TeamHierarchy(String id, Long projectManagerId, String projectManagerName, String projectManagerEmail) {
        this.id = id;
        this.projectManagerId = projectManagerId;
        this.projectManagerName = projectManagerName;
        this.projectManagerEmail = projectManagerEmail;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Long getProjectManagerId() {
        return projectManagerId;
    }

    public void setProjectManagerId(Long projectManagerId) {
        this.projectManagerId = projectManagerId;
    }

    public String getProjectManagerName() {
        return projectManagerName;
    }

    public void setProjectManagerName(String projectManagerName) {
        this.projectManagerName = projectManagerName;
    }

    public String getProjectManagerEmail() {
        return projectManagerEmail;
    }

    public void setProjectManagerEmail(String projectManagerEmail) {
        this.projectManagerEmail = projectManagerEmail;
    }

    public String getPmResponsibilities() {
        return pmResponsibilities;
    }

    public void setPmResponsibilities(String pmResponsibilities) {
        this.pmResponsibilities = pmResponsibilities;
    }

    public List<String> getManagedProjects() {
        return managedProjects;
    }

    public void setManagedProjects(List<String> managedProjects) {
        this.managedProjects = managedProjects != null ? managedProjects : new ArrayList<>();
    }

    public java.util.Map<String, String> getProjectResponsibilities() {
        if (projectResponsibilities == null) {
            projectResponsibilities = new java.util.HashMap<>();
        }
        return projectResponsibilities;
    }

    public void setProjectResponsibilities(java.util.Map<String, String> projectResponsibilities) {
        this.projectResponsibilities = projectResponsibilities != null ? projectResponsibilities : new java.util.HashMap<>();
    }

    public List<LeadNode> getTeamLeads() {
        return teamLeads;
    }

    public void setTeamLeads(List<LeadNode> teamLeads) {
        this.teamLeads = teamLeads != null ? teamLeads : new ArrayList<>();
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }
}
