package canteenManagment.main.UserEntity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;


import org.springframework.security.core.userdetails.User;
@Document(collection = "task")
public class Task {
    @Id
    private Long id;

    private String title;
    private String description;

    // Shared lifecycle with AssignTask (see WorkStatus).
    private WorkStatus status;

    // Same rework trail as AssignTask: stamped when the task leaves DONE.
    private Integer reopenCount;

    private String lastReopenNote;

    private Project project;

    private UserEntity user;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public WorkStatus getStatus() {
		return status;
	}

	public void setStatus(WorkStatus status) {
		this.status = status;
	}

	public Integer getReopenCount() {
		return reopenCount;
	}

	public void setReopenCount(Integer reopenCount) {
		this.reopenCount = reopenCount;
	}

	public String getLastReopenNote() {
		return lastReopenNote;
	}

	public void setLastReopenNote(String lastReopenNote) {
		this.lastReopenNote = lastReopenNote;
	}

	public Project getProject() {
		return project;
	}

	public void setProject(Project project) {
		this.project = project;
	}

	public UserEntity getUser() {
		return user;
	}

	public void setUser(UserEntity user) {
		this.user = user;
	}


}