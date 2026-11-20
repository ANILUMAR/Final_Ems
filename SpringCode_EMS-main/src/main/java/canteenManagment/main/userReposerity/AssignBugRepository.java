package canteenManagment.main.userReposerity;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.AssignBug;

@Repository
public interface AssignBugRepository extends MongoRepository<AssignBug, Long> {

    List<AssignBug> findByAssignedTo_Id(Long user);

}
