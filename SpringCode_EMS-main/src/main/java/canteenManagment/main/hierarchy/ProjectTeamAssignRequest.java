package canteenManagment.main.hierarchy;

import java.util.ArrayList;
import java.util.List;

public class ProjectTeamAssignRequest {
    private String projectName;
    private String projectDescription;

    private Long pmUserId;
    private String pmEmail;
    private String pmName;
    private String pmResponsibilities;

    private Long devLeadId;
    private String devLeadEmail;
    private String devLeadName;
    private String devLeadTitle;
    private String devLeadResponsibilities;
    private Boolean devLeadProductionSupport = false;

    private Long testerLeadId;
    private String testerLeadEmail;
    private String testerLeadName;
    private String testerLeadTitle;
    private String testerLeadResponsibilities;
    private Boolean testerLeadProductionSupport = false;

    // Optional submission/approval action during assignment ("SAVE_DRAFT", "SUBMIT", "APPROVE")
    private String approvalAction;
    private String notes;

    private List<MemberAssignmentItem> members = new ArrayList<>();

    public ProjectTeamAssignRequest() {}

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

    public Long getPmUserId() {
        return pmUserId;
    }

    public void setPmUserId(Long pmUserId) {
        this.pmUserId = pmUserId;
    }

    public String getPmEmail() {
        return pmEmail;
    }

    public void setPmEmail(String pmEmail) {
        this.pmEmail = pmEmail;
    }

    public String getPmName() {
        return pmName;
    }

    public void setPmName(String pmName) {
        this.pmName = pmName;
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

    public String getDevLeadEmail() {
        return devLeadEmail;
    }

    public void setDevLeadEmail(String devLeadEmail) {
        this.devLeadEmail = devLeadEmail;
    }

    public String getDevLeadName() {
        return devLeadName;
    }

    public void setDevLeadName(String devLeadName) {
        this.devLeadName = devLeadName;
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

    public String getTesterLeadEmail() {
        return testerLeadEmail;
    }

    public void setTesterLeadEmail(String testerLeadEmail) {
        this.testerLeadEmail = testerLeadEmail;
    }

    public String getTesterLeadName() {
        return testerLeadName;
    }

    public void setTesterLeadName(String testerLeadName) {
        this.testerLeadName = testerLeadName;
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

    public String getApprovalAction() {
        return approvalAction;
    }

    public void setApprovalAction(String approvalAction) {
        this.approvalAction = approvalAction;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public List<MemberAssignmentItem> getMembers() {
        return members;
    }

    public void setMembers(List<MemberAssignmentItem> members) {
        this.members = members != null ? members : new ArrayList<>();
    }

    public static class MemberAssignmentItem {
        private Long memberId;
        private String memberEmail;
        private String memberName;
        private String memberRole; // EMPLOYEE or TESTER
        private String responsibilities;
        private String priority; // HIGH, MEDIUM, LOW
        private Integer allocation;
        private String notes;
        private Boolean productionSupport = false;

        public MemberAssignmentItem() {}

        public Long getMemberId() {
            return memberId;
        }

        public void setMemberId(Long memberId) {
            this.memberId = memberId;
        }

        public String getMemberEmail() {
            return memberEmail;
        }

        public void setMemberEmail(String memberEmail) {
            this.memberEmail = memberEmail;
        }

        public String getMemberName() {
            return memberName;
        }

        public void setMemberName(String memberName) {
            this.memberName = memberName;
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

        public Boolean getProductionSupport() {
            return productionSupport != null && productionSupport;
        }

        public void setProductionSupport(Boolean productionSupport) {
            this.productionSupport = productionSupport != null ? productionSupport : false;
        }
    }
}
