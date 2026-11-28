package canteenManagment.main.hierarchy;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectHierarchyApprovalRepository extends MongoRepository<ProjectHierarchyApproval, String> {
    Optional<ProjectHierarchyApproval> findByProjectNameIgnoreCase(String projectName);
}
