package canteenManagment.main.UserEntity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;


import org.springframework.security.core.userdetails.User;
@Document(collection = "work_log")
public class WorkLog {
	   @Id
	    private Long id;

	    private UserEntity user;

	    private Task task;

	    private Double hours;
	    private LocalDate logDate;
		public Long getId() {
			return id;
		}
		public void setId(Long id) {
			this.id = id;
		}
		
		public Task getTask() {
			return task;
		}
		public void setTask(Task task) {
			this.task = task;
		}
		public Double getHours() {
			return hours;
		}
		public void setHours(Double hours) {
			this.hours = hours;
		}
		public LocalDate getLogDate() {
			return logDate;
		}
		public void setLogDate(LocalDate logDate) {
			this.logDate = logDate;
		}
		public UserEntity getUser() {
			return user;
		}
		public void setUser(UserEntity user) {
			this.user = user;
		}

	    
	    
}