package canteenManagment.main.userReposerity;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.Task;
@Repository

public interface TaskRepository extends MongoRepository<Task, Long> {
}