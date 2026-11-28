package canteenManagment.main.hierarchy;

import java.util.Date;
import java.util.Locale;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Tracks the approval workflow and authorization state for a project's team hierarchy.
 *
 * <p>Lifecycle:
 * <ul>
 *   <li><b>DRAFT</b>: Project Manager configures team hierarchy. Work not authorized.</li>
 *   <li><b>SUBMITTED</b>: Project Manager submits hierarchy to CEO/Director for approval. Work not authorized.</li>
 *   <li><b>APPROVED</b>: CEO/Director approves hierarchy. Authorization granted to begin project work.</li>
 *   <li><b>REJECTED</b>: CEO/Director requests revisions. Project Manager adjusts hierarchy and resubmits.</li>
 * </ul>
 * </p>
 */
@Document(collection = "project_hierarchy_approval")
public class ProjectHierarchyApproval {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_SUBMITTED = "SUBMITTED";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";

    @Id
    private String id; // normalized projectName (lowercase)

    private String projectName;
    private String status = STATUS_DRAFT;

    // PM Submission details
    private String submittedBy;
    private String submittedByName;
    private Date submittedAt;
    private String submissionNotes;

    // CEO / Director Review details
    private String approvedBy;
    private String approvedByName;
    private Date approvedAt;
    private String rejectionRemarks;

    // Work authorization flag
    private boolean workAuthorized = false;

    private Date createdAt;
    private Date updatedAt;

    public ProjectHierarchyApproval() {
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    public ProjectHierarchyApproval(String projectName, String status) {
        this();
        this.projectName = projectName;
        this.id = normalizeId(projectName);
        this.status = status != null ? status : STATUS_DRAFT;
        this.workAuthorized = STATUS_APPROVED.equalsIgnoreCase(this.status);
    }

    public static String normalizeId(String projectName) {
        return projectName == null ? "" : projectName.trim().toLowerCase(Locale.ROOT);
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
        if (this.id == null && projectName != null) {
            this.id = normalizeId(projectName);
        }
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
        this.workAuthorized = STATUS_APPROVED.equalsIgnoreCase(status);
        this.updatedAt = new Date();
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

    public Date getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Date submittedAt) {
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

    public Date getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(Date approvedAt) {
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
