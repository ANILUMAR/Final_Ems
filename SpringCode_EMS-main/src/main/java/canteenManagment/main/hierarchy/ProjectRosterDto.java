package canteenManagment.main.hierarchy;

import java.util.ArrayList;
import java.util.List;

public class ProjectRosterDto {
    private String projectName;
    private String projectDescription;

    private Long pmId;
    private String pmName;
    private String pmEmail;
    private String pmResponsibilities;

    private Long devLeadId;
    private String devLeadName;
    private String devLeadEmail;
    private String devLeadTitle;
    private String devLeadResponsibilities;
    private Boolean devLeadProductionSupport = false;

    private Long testerLeadId;
    private String testerLeadName;
    private String testerLeadEmail;
    private String testerLeadTitle;
    private String testerLeadResponsibilities;
    private Boolean testerLeadProductionSupport = false;

    // Approval & Authorization Fields
    private String approvalStatus = "DRAFT";
    private String submittedBy;
    private String submittedByName;
    private java.util.Date submittedAt;
    private String submissionNotes;
    private String approvedBy;
    private String approvedByName;
    private java.util.Date approvedAt;
    private String rejectionRemarks;
    private boolean workAuthorized = false;

    // User-specific context when returning user projects
    private String myRoleOnProject;
    private String myResponsibilities;
    private Integer myAllocation;
    private String myPriority;

    private List<ProjectMemberDto> members = new ArrayList<>();

    public ProjectRosterDto() {}

    public ProjectRosterDto(String projectName, String projectDescription) {
        this.projectName = projectName;
        this.projectDescription = projectDescription;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getProjectDescription() {
        return projectDescription;
    }

    public void setProjectDescription(String projectDescription) {
        this.projectDescription = projectDescription;
    }

    public Long getPmId() {
        return pmId;
    }

    public void setPmId(Long pmId) {
        this.pmId = pmId;
    }

    public String getPmName() {
        return pmName;
    }

    public void setPmName(String pmName) {
        this.pmName = pmName;
    }

    public String getPmEmail() {
        return pmEmail;
    }

    public void setPmEmail(String pmEmail) {
        this.pmEmail = pmEmail;
    }

    public String getPmResponsibilities() {
        return pmResponsibilities;
    }

    public void setPmResponsibilities(String pmResponsibilities) {
        this.pmResponsibilities = pmResponsibilities;
    }

    public Long getDevLeadId() {
        return devLeadId;
    }

    public void setDevLeadId(Long devLeadId) {
        this.devLeadId = devLeadId;
    }

    public String getDevLeadName() {
        return devLeadName;
    }

    public void setDevLeadName(String devLeadName) {
        this.devLeadName = devLeadName;
    }

    public String getDevLeadEmail() {
        return devLeadEmail;
    }

    public void setDevLeadEmail(String devLeadEmail) {
        this.devLeadEmail = devLeadEmail;
    }

    public String getDevLeadTitle() {
        return devLeadTitle;
    }

    public void setDevLeadTitle(String devLeadTitle) {
        this.devLeadTitle = devLeadTitle;
    }

    public String getDevLeadResponsibilities() {
        return devLeadResponsibilities;
    }

    public void setDevLeadResponsibilities(String devLeadResponsibilities) {
        this.devLeadResponsibilities = devLeadResponsibilities;
    }

    public Long getTesterLeadId() {
        return testerLeadId;
    }

    public void setTesterLeadId(Long testerLeadId) {
        this.testerLeadId = testerLeadId;
    }

    public String getTesterLeadName() {
        return testerLeadName;
    }

    public void setTesterLeadName(String testerLeadName) {
        this.testerLeadName = testerLeadName;
    }

    public String getTesterLeadEmail() {
        return testerLeadEmail;
    }

    public void setTesterLeadEmail(String testerLeadEmail) {
        this.testerLeadEmail = testerLeadEmail;
    }

    public String getTesterLeadTitle() {
        return testerLeadTitle;
    }

    public void setTesterLeadTitle(String testerLeadTitle) {
        this.testerLeadTitle = testerLeadTitle;
    }

    public String getTesterLeadResponsibilities() {
        return testerLeadResponsibilities;
    }

    public void setTesterLeadResponsibilities(String testerLeadResponsibilities) {
        this.testerLeadResponsibilities = testerLeadResponsibilities;
    }

    public Boolean getDevLeadProductionSupport() {
        return devLeadProductionSupport != null && devLeadProductionSupport;
    }

    public void setDevLeadProductionSupport(Boolean devLeadProductionSupport) {
        this.devLeadProductionSupport = devLeadProductionSupport != null ? devLeadProductionSupport : false;
    }

    public Boolean getTesterLeadProductionSupport() {
        return testerLeadProductionSupport != null && testerLeadProductionSupport;
    }

    public void setTesterLeadProductionSupport(Boolean testerLeadProductionSupport) {
        this.testerLeadProductionSupport = testerLeadProductionSupport != null ? testerLeadProductionSupport : false;
    }

    public String getApprovalStatus() {
        return approvalStatus;
    }

    public void setApprovalStatus(String approvalStatus) {
        this.approvalStatus = approvalStatus;
    }

    public String getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(String submittedBy) {
        this.submittedBy = submittedBy;
    }

    public String getSubmittedByName() {
        return submittedByName;
    }

    public void setSubmittedByName(String submittedByName) {
        this.submittedByName = submittedByName;
    }

    public java.util.Date getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(java.util.Date submittedAt) {
        this.submittedAt = submittedAt;
    }

    public String getSubmissionNotes() {
        return submissionNotes;
    }

    public void setSubmissionNotes(String submissionNotes) {
        this.submissionNotes = submissionNotes;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public String getApprovedByName() {
        return approvedByName;
    }

    public void setApprovedByName(String approvedByName) {
        this.approvedByName = approvedByName;
    }

    public java.util.Date getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(java.util.Date approvedAt) {
        this.approvedAt = approvedAt;
    }

    public String getRejectionRemarks() {
        return rejectionRemarks;
    }

    public void setRejectionRemarks(String rejectionRemarks) {
        this.rejectionRemarks = rejectionRemarks;
    }

    public boolean isWorkAuthorized() {
        return workAuthorized;
    }

    public void setWorkAuthorized(boolean workAuthorized) {
        this.workAuthorized = workAuthorized;
    }

    public List<ProjectMemberDto> getMembers() {
        return members;
    }

    public void setMembers(List<ProjectMemberDto> members) {
        this.members = members != null ? members : new ArrayList<>();
    }

    public String getMyRoleOnProject() {
        return myRoleOnProject;
    }

    public void setMyRoleOnProject(String myRoleOnProject) {
        this.myRoleOnProject = myRoleOnProject;
    }

    public String getMyResponsibilities() {
        return myResponsibilities;
    }

    public void setMyResponsibilities(String myResponsibilities) {
        this.myResponsibilities = myResponsibilities;
    }

    public Integer getMyAllocation() {
        return myAllocation;
    }

    public void setMyAllocation(Integer myAllocation) {
        this.myAllocation = myAllocation;
    }

    public String getMyPriority() {
        return myPriority;
    }

    public void setMyPriority(String myPriority) {
        this.myPriority = myPriority;
    }

    public static class ProjectMemberDto {
        private Long memberId;
        private String memberName;
        private String memberEmail;
        private String memberRole;
        private String responsibilities;
        private String priority;
        private Integer allocation;
        private String notes;
        private Boolean productionSupport = false;
        private String reportingLeadEmail;
        private String reportingLeadName;
        private String reportingLeadTitle;

        public ProjectMemberDto() {}

        public Long getMemberId() {
            return memberId;
        }

        public void setMemberId(Long memberId) {
            this.memberId = memberId;
        }

        public String getMemberName() {
            return memberName;
        }

        public void setMemberName(String memberName) {
            this.memberName = memberName;
        }

        public String getMemberEmail() {
            return memberEmail;
        }

        public void setMemberEmail(String memberEmail) {
            this.memberEmail = memberEmail;
        }

        public String getMemberRole() {
            return memberRole;
        }

        public void setMemberRole(String memberRole) {
            this.memberRole = memberRole;
        }

        public String getResponsibilities() {
            return responsibilities;
        }

        public void setResponsibilities(String responsibilities) {
            this.responsibilities = responsibilities;
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

        public String getReportingLeadEmail() {
            return reportingLeadEmail;
        }

        public void setReportingLeadEmail(String reportingLeadEmail) {
            this.reportingLeadEmail = reportingLeadEmail;
        }

        public String getReportingLeadName() {
            return reportingLeadName;
        }

        public void setReportingLeadName(String reportingLeadName) {
            this.reportingLeadName = reportingLeadName;
        }

        public String getReportingLeadTitle() {
            return reportingLeadTitle;
        }

        public void setReportingLeadTitle(String reportingLeadTitle) {
            this.reportingLeadTitle = reportingLeadTitle;
        }

        public Boolean getProductionSupport() {
            return productionSupport != null && productionSupport;
        }

        public void setProductionSupport(Boolean productionSupport) {
            this.productionSupport = productionSupport != null ? productionSupport : false;
        }
    }
}
