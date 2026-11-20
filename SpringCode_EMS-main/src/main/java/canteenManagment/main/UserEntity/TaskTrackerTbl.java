package canteenManagment.main.UserEntity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

import lombok.Data;
@Document(collection = "task_tracker_tbl")
public class TaskTrackerTbl {

    @Id
    private Long id;   // Task ID (Unique Identifier)

    private String taskTitle;   // Task Title

    // Many tasks belong to one project
    private Project project;   // Project

    // Module → Master Data
    private MasterModuleDescriptionTbl module;

    // Submodule → Master Data
    private MasterSubModuleDescriptionTbl subModule;

    // Screen → Master Data
   private MasterScreensTbl screen;

    private String description;   // Task details

    private String stepsToReproduce;   // Steps / Scenarios

    private String attachmentPath;   // File path / Screenshot / Docs

    private String comments;   // Communication between devs & testers

    // Who generated the task
    private UserEntity generatedBy;

    private LocalDateTime generatedDate;

    // Who tested the task
    private UserEntity testedBy;

    private LocalDateTime testedDate;

    private TestingStatus Testing;   // PASSED, FAILED, IN_PROGRESS, BLOCKED

    private String testingRemarks;   // Remarks after testing

    // Assigned to which user
    private UserEntity assignedTo;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getTaskTitle() {
		return taskTitle;
	}

	public void setTaskTitle(String taskTitle) {
		this.taskTitle = taskTitle;
	}

	public Project getProject() {
		return project;
	}

	public void setProject(Project project) {
		this.project = project;
	}

	

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getStepsToReproduce() {
		return stepsToReproduce;
	}

	public void setStepsToReproduce(String stepsToReproduce) {
		this.stepsToReproduce = stepsToReproduce;
	}

	public String getAttachmentPath() {
		return attachmentPath;
	}

	public void setAttachmentPath(String attachmentPath) {
		this.attachmentPath = attachmentPath;
	}

	public String getComments() {
		return comments;
	}

	public void setComments(String comments) {
		this.comments = comments;
	}

	public UserEntity getGeneratedBy() {
		return generatedBy;
	}

	public void setGeneratedBy(UserEntity generatedBy) {
		this.generatedBy = generatedBy;
	}

	public LocalDateTime getGeneratedDate() {
		return generatedDate;
	}

	public void setGeneratedDate(LocalDateTime generatedDate) {
		this.generatedDate = generatedDate;
	}

	public UserEntity getTestedBy() {
		return testedBy;
	}

	public void setTestedBy(UserEntity testedBy) {
		this.testedBy = testedBy;
	}

	public LocalDateTime getTestedDate() {
		return testedDate;
	}

	public void setTestedDate(LocalDateTime testedDate) {
		this.testedDate = testedDate;
	}


	public String getTestingRemarks() {
		return testingRemarks;
	}

	public void setTestingRemarks(String testingRemarks) {
		this.testingRemarks = testingRemarks;
	}

	public UserEntity getAssignedTo() {
		return assignedTo;
	}

	public void setAssignedTo(UserEntity assignedTo) {
		this.assignedTo = assignedTo;
	}
    
    
}




