package canteenManagment.main.userReposerity;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.MasterAssignmentTbl;

/**
 * Plain CRUD only. The distinct-value lookups used by the create-task screen are
 * served through MongoTemplate in AssignTaskController, because MongoDB has no
 * "SELECT DISTINCT" equivalent on a repository interface.
 */
@Repository
public interface MasterAssignmentRepository extends MongoRepository<MasterAssignmentTbl, Integer> {
}
