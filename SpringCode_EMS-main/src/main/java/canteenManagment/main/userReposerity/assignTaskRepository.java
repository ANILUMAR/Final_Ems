package canteenManagment.main.userReposerity;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.AssignTask;

@Repository
public interface assignTaskRepository extends MongoRepository<AssignTask, Long> {

    List<AssignTask> findByAssignedTo_Id(Long user);

}
