package canteenManagment.main.userReposerity;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.WorkLog;
@Repository

public interface WorkLogRepository extends MongoRepository<WorkLog, Long> {
}
