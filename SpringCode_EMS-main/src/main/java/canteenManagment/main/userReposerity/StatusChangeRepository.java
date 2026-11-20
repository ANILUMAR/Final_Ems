package canteenManagment.main.userReposerity;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.StatusChange;

@Repository
public interface StatusChangeRepository extends MongoRepository<StatusChange, Long> {

    List<StatusChange> findByEntityTypeAndEntityIdOrderByChangedAtDesc(String entityType, Long entityId);
}
