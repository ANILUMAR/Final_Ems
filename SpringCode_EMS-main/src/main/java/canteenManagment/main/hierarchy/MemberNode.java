package canteenManagment.main.hierarchy;

import java.util.ArrayList;
import java.util.List;

public class MemberNode {
    private Long memberId;
    private String memberName;
    private String memberEmail;
    private String memberRole; // EMPLOYEE (Developer) or TESTER (Tester)
    private String responsibilities; // Member's assigned responsibility in the team
    private Boolean productionSupport = false;
    private List<ProjectAssignment> projectAssignments = new ArrayList<>();

    public MemberNode() {}

    public MemberNode(Long memberId, String memberName, String memberEmail, String memberRole) {
        this.memberId = memberId;
        this.memberName = memberName;
        this.memberEmail = memberEmail;
        this.memberRole = memberRole;
    }

    public MemberNode(Long memberId, String memberName, String memberEmail, String memberRole, String responsibilities) {
        this.memberId = memberId;
        this.memberName = memberName;
        this.memberEmail = memberEmail;
        this.memberRole = memberRole;
        this.responsibilities = responsibilities;
    }

    public String getResponsibilities() {
        return responsibilities;
    }

    public void setResponsibilities(String responsibilities) {
        this.responsibilities = responsibilities;
    }

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

    public List<ProjectAssignment> getProjectAssignments() {
        return projectAssignments;
    }

    public void setProjectAssignments(List<ProjectAssignment> projectAssignments) {
        this.projectAssignments = projectAssignments != null ? projectAssignments : new ArrayList<>();
    }

    public Boolean getProductionSupport() {
        return productionSupport != null && productionSupport;
    }

    public void setProductionSupport(Boolean productionSupport) {
        this.productionSupport = productionSupport != null ? productionSupport : false;
    }
}
