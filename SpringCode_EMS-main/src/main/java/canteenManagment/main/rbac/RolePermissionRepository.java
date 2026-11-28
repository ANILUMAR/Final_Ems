package canteenManagment.main.rbac;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RolePermissionRepository extends MongoRepository<RolePermissionConfig, String> {

    Optional<RolePermissionConfig> findByRole(String role);

    boolean existsByRole(String role);

    void deleteByRole(String role);
}
