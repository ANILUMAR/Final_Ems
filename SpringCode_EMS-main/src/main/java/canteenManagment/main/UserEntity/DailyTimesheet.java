package canteenManagment.main.UserEntity;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "daily_timesheets")
public class DailyTimesheet {
    @Id
    private String id;

    private Long employeeId;
    private String employeeName;
    private String employeeEmail;
    private String employeeRole;

    private LocalDate workDate;
    private Double totalHours;
    /** DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED */
    private String status;

    private String reportingPersonEmail;
    private String reportingPersonName;

    private String rejectionReason;
    private String overtimeRemarks;

    private Date createdAt;
    private Date submittedAt;
    private Date reviewedAt;
    private String reviewedBy;
    private String reviewedByName;

    private List<DailyTimesheetItem> entries = new ArrayList<>();
    private List<TimesheetAudit> history = new ArrayList<>();

    public DailyTimesheet() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public String getEmployeeName() {
        return employeeName;
    }

    public void setEmployeeName(String employeeName) {
        this.employeeName = employeeName;
    }

    public String getEmployeeEmail() {
        return employeeEmail;
    }

    public void setEmployeeEmail(String employeeEmail) {
        this.employeeEmail = employeeEmail;
    }

    public String getEmployeeRole() {
        return employeeRole;
    }

    public void setEmployeeRole(String employeeRole) {
        this.employeeRole = employeeRole;
    }

    public LocalDate getWorkDate() {
        return workDate;
    }

    public void setWorkDate(LocalDate workDate) {
        this.workDate = workDate;
    }

    public Double getTotalHours() {
        return totalHours;
    }

    public void setTotalHours(Double totalHours) {
        this.totalHours = totalHours;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReportingPersonEmail() {
        return reportingPersonEmail;
    }

    public void setReportingPersonEmail(String reportingPersonEmail) {
        this.reportingPersonEmail = reportingPersonEmail;
    }

    public String getReportingPersonName() {
        return reportingPersonName;
    }

    public void setReportingPersonName(String reportingPersonName) {
        this.reportingPersonName = reportingPersonName;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public String getOvertimeRemarks() {
        return overtimeRemarks;
    }

    public void setOvertimeRemarks(String overtimeRemarks) {
        this.overtimeRemarks = overtimeRemarks;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Date submittedAt) {
        this.submittedAt = submittedAt;
    }

    public Date getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(Date reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public String getReviewedByName() {
        return reviewedByName;
    }

    public void setReviewedByName(String reviewedByName) {
        this.reviewedByName = reviewedByName;
    }

    public List<DailyTimesheetItem> getEntries() {
        return entries;
    }

    public void setEntries(List<DailyTimesheetItem> entries) {
        this.entries = entries;
    }

    public List<TimesheetAudit> getHistory() {
        return history;
    }

    public void setHistory(List<TimesheetAudit> history) {
        this.history = history;
    }
}
