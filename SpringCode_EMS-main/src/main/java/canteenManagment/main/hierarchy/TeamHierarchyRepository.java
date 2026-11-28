package canteenManagment.main.hierarchy;

import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TeamHierarchyRepository extends MongoRepository<TeamHierarchy, String> {
    Optional<TeamHierarchy> findByProjectManagerEmailIgnoreCase(String projectManagerEmail);
    Optional<TeamHierarchy> findByProjectManagerId(Long projectManagerId);
}
