package canteenManagment.main.hierarchy;

import java.util.ArrayList;
import java.util.List;

public class LeadNode {
    private Long leadId;
    private String leadName;
    private String leadEmail;
    private String leadRole; // DEVELOPER_LEAD or TESTER_LEAD
    private String leadTitle; // e.g. "Java Lead", "Testing Lead"
    private String responsibilities; // Defined responsibilities for this team leader
    private Boolean productionSupport = false;
    private List<String> assignedProjects = new ArrayList<>();
    private java.util.Map<String, String> projectResponsibilities = new java.util.HashMap<>();
    private java.util.Map<String, Boolean> projectProductionSupport = new java.util.HashMap<>();
    private List<MemberNode> members = new ArrayList<>();

    public LeadNode() {}

    public LeadNode(Long leadId, String leadName, String leadEmail, String leadRole, String leadTitle) {
        this.leadId = leadId;
        this.leadName = leadName;
        this.leadEmail = leadEmail;
        this.leadRole = leadRole;
        this.leadTitle = leadTitle;
    }

    public LeadNode(Long leadId, String leadName, String leadEmail, String leadRole, String leadTitle, String responsibilities) {
        this.leadId = leadId;
        this.leadName = leadName;
        this.leadEmail = leadEmail;
        this.leadRole = leadRole;
        this.leadTitle = leadTitle;
        this.responsibilities = responsibilities;
    }

    public String getResponsibilities() {
        return responsibilities;
    }

    public void setResponsibilities(String responsibilities) {
        this.responsibilities = responsibilities;
    }

    public List<String> getAssignedProjects() {
        return assignedProjects != null ? assignedProjects : new ArrayList<>();
    }

    public void setAssignedProjects(List<String> assignedProjects) {
        this.assignedProjects = assignedProjects != null ? assignedProjects : new ArrayList<>();
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

    public Long getLeadId() {
        return leadId;
    }

    public void setLeadId(Long leadId) {
        this.leadId = leadId;
    }

    public String getLeadName() {
        return leadName;
    }

    public void setLeadName(String leadName) {
        this.leadName = leadName;
    }

    public String getLeadEmail() {
        return leadEmail;
    }

    public void setLeadEmail(String leadEmail) {
        this.leadEmail = leadEmail;
    }

    public String getLeadRole() {
        return leadRole;
    }

    public void setLeadRole(String leadRole) {
        this.leadRole = leadRole;
    }

    public String getLeadTitle() {
        return leadTitle;
    }

    public void setLeadTitle(String leadTitle) {
        this.leadTitle = leadTitle;
    }

    public List<MemberNode> getMembers() {
        return members;
    }

    public void setMembers(List<MemberNode> members) {
        this.members = members != null ? members : new ArrayList<>();
    }

    public Boolean getProductionSupport() {
        return productionSupport != null && productionSupport;
    }

    public void setProductionSupport(Boolean productionSupport) {
        this.productionSupport = productionSupport != null ? productionSupport : false;
    }

    public java.util.Map<String, Boolean> getProjectProductionSupport() {
        if (projectProductionSupport == null) {
            projectProductionSupport = new java.util.HashMap<>();
        }
        return projectProductionSupport;
    }

    public void setProjectProductionSupport(java.util.Map<String, Boolean> projectProductionSupport) {
        this.projectProductionSupport = projectProductionSupport != null ? projectProductionSupport : new java.util.HashMap<>();
    }
}
