package canteenManagment.main.userReposerity;

import org.springframework.data.mongodb.repository.MongoRepository;

import canteenManagment.main.UserEntity.DeletedTask;

public interface DeletedTaskRepository  extends MongoRepository<DeletedTask, Long>{

}
