package canteenManagment.main.userReposerity;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.MasterProjectTbl;

@Repository
public interface MasterProjectRepository extends MongoRepository<MasterProjectTbl, Integer> {
    // Counting is inherited from MongoRepository#count().
    Optional<MasterProjectTbl> findFirstByProjectNameIgnoreCase(String projectName);
}
